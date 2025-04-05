/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import { StatusCodes } from "http-status-codes";
import User from "../../models/user.model.js";
import sendEmail from "../../utils/email.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../middleware/asyncHandler.middleware.js";
import {
  uploadFileToCloudinary,
  removeFileToCloudinary,
} from "../../config/cloudinary.config.js";
import redisClient from "../../config/redis.config.js";
import {
  cookieOptions,
  USER_CACHE_TTL,
  RATE_LIMIT_WINDOW,
  MAX_PASSWORD_ATTEMPTS,
} from "../../constants/constant.js";

// Helper: Redis Pipeline Executor
const redisPipeline = async (...commands) => {
  const pipeline = redisClient.pipeline();
  commands.forEach(([cmd, ...args]) => pipeline[cmd](...args));
  return pipeline.exec();
};

// Get User Profile
export const getProfile = asyncHandler(async (req, res) => {
  const cacheKey = `user:${req.user._id}`;

  try {
    const cachedUser = await redisClient.hGetAll(cacheKey);
    if (cachedUser && Object.keys(cachedUser).length) {
      return new ApiResponse(StatusCodes.OK, {
        ...cachedUser,
        createdAt: new Date(cachedUser.createdAt),
      }).send(res);
    }
  } catch (error) {
    console.error("Cache read error:", error);
  }

  const user = await User.findById(req.user._id);

  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

  try {
    await redisClient.hSet(cacheKey, {
      id: user._id.toString(),
      fullName: user.fullName,
      userName: user.userName,
      email: user.email,
      avatar: user.avatar?.url || "",
      role: user.role,
      isVerified: user.isVerified.toString(),
      createdAt: user.createdAt.toISOString(),
    });
    await redisClient.expire(cacheKey, USER_CACHE_TTL);
  } catch (error) {
    console.error("Cache write error:", error);
  }
  return new ApiResponse(StatusCodes.OK, user).send(res);
});

// Update User Profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, userName, email } = req.body;

  if ([fullName, userName, email].some((field) => !field?.trim())) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "All fields are required");
  }

  const existingUser = await User.findOne({
    $or: [{ userName }, { email }],
    _id: { $ne: req.user._id },
  });

  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, "Username/email taken");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { fullName, userName, email },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  // Cache Operations
  try {
    await redisPipeline(
      ["hSet", `user:${user._id}`, "fullName", user.fullName],
      ["hSet", `user:${user._id}`, "userName", user.userName],
      ["hSet", `user:${user._id}`, "email", user.email],
      ["expire", `user:${user._id}`, USER_CACHE_TTL],
      ["del", `user:${user.previous("userName")}`]
    );
  } catch (error) {
    console.error("Cache update failed:", error);
  }

  return new ApiResponse(StatusCodes.OK, user, "Profile updated").send(res);
});

// Update Avatar
export const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalFile = req.file?.path;
  if (!avatarLocalFile) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar image required");
  }

  const user = await User.findById(req.user._id);
  const oldPublicId = user.avatar?.public_id;

  const avatar = await uploadFileToCloudinary(avatarLocalFile);
  if (!avatar?.secure_url) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar upload failed");
  }

  user.avatar = {
    public_id: avatar.public_id,
    url: avatar.secure_url,
  };
  await user.save();

  try {
    await redisPipeline(
      ["hSet", `user:${user._id}`, "avatar", avatar.secure_url],
      ["expire", `user:${user._id}`, USER_CACHE_TTL]
    );
  } catch (error) {
    console.error("Cache update failed:", error);
  }

  if (oldPublicId) {
    await removeFileToCloudinary(oldPublicId).catch((error) =>
      console.error("Avatar cleanup failed:", error)
    );
  }

  return new ApiResponse(
    StatusCodes.OK,
    { avatar: user.avatar },
    "Avatar updated"
  ).send(res);
});

// Change Password
export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const rateLimitKey = `pwd_change:${req.user._id}`;

  // Rate Limiting
  try {
    const attempts = await redisClient.incr(rateLimitKey);
    if (attempts === 1) {
      await redisClient.expire(rateLimitKey, RATE_LIMIT_WINDOW);
    }
    if (attempts > MAX_PASSWORD_ATTEMPTS) {
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        "Too many attempts. Try again later."
      );
    }
  } catch (error) {
    console.error("Rate limit check failed:", error);
  }

  if (oldPassword === newPassword) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "New password must differ");
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(oldPassword))) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid current password");
  }

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Invalidate Sessions
  try {
    const sessionKeys = await redisClient.keys(`session:${user._id}:*`);
    if (sessionKeys.length) {
      await redisClient.del(sessionKeys);
    }
  } catch (error) {
    console.error("Session cleanup failed:", error);
  }

  // Notify User
  try {
    await sendEmail({
      to: user.email,
      subject: "Password Changed",
      template: "passwordChanged",
      context: {
        name: user.fullName,
        timestamp: new Date().toLocaleString(),
        device: req.headers["user-agent"],
        ip: req.ip,
      },
    });
  } catch (error) {
    console.error("Password change notification failed:", error);
  }

  return new ApiResponse(
    StatusCodes.OK,
    null,
    "Password updated. All sessions terminated."
  ).send(res);
});

// Delete Account
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Password required");
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

  if (!(await user.comparePassword(password))) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid password");
  }

  // Cleanup Operations
  const cleanupPromises = [];

  if (user.avatar?.public_id) {
    cleanupPromises.push(removeFileToCloudinary(user.avatar.public_id));
  }

  cleanupPromises.push(
    redisClient.del(`user:${user._id}`),
    redisClient.del(`user:${user.userName}`),
    redisClient
      .keys(`session:${user._id}:*`)
      .then((keys) => (keys.length ? redisClient.del(keys) : null))
  );

  await Promise.allSettled(cleanupPromises);
  await User.findByIdAndDelete(user._id);

  res
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions);

  return new ApiResponse(
    StatusCodes.OK,
    null,
    "Account and all associated data deleted"
  ).send(res);
});
