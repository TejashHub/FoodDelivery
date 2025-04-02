/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import User from "../../model/user.model.js";
import sendEmail from "../../utils/nodemailer.js";
import { ApiError } from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../middleware/asyncHandler.middleware.js";
import {
  cloudinaryFileUpload,
  cloudinaryFileRemove,
} from "../../utils/cloudinary.js";

// Cookies Options
const cookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Get User Profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  return res.status(StatusCodes.OK).json({
    success: true,
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        userName: user.userName,
        email: user.email,
        avatar: user.avatar?.url,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    },
  });
});

// Update User Profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, userName } = req.body;
  const updateData = { fullName, userName };

  if (req.file) {
    const avatar = await cloudinaryFileUpload(req.file.path, "avatars");
    if (!avatar) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar upload failed");
    }

    if (req.user.avatar?.public_id) {
      await cloudinaryFileRemove(req.user.avatar.public_id);
    }

    updateData.avatar = {
      public_id: avatar.public_id,
      url: avatar.secure_url,
    };
  }

  const user = await User.findByIdAndUpdate(req.user._id, updateData, {
    new: true,
    runValidators: true,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        userName: user.userName,
        email: user.email,
        avatar: user.avatar?.url,
      },
    },
  });
});

// Change Password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Current and new password are required"
    );
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "New password must be different from current password"
    );
  }

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Password must contain at least 8 characters, including uppercase, lowercase, number and special character"
    );
  }

  const user = await User.findById(req.user._id).select("+password");

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      "Current password is incorrect"
    );
  }

  user.password = newPassword;
  await user.save();

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Changed",
      template: "passwordChanged",
      data: {
        name: user.fullName,
        timestamp: new Date().toLocaleString(),
      },
    });
  } catch (error) {
    console.error("Password change notification failed:", error);
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Password changed successfully",
  });
});

// Delete Account
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Password is required");
  }

  const user = await User.findById(req.user._id).select("+password");
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Password is incorrect");
  }

  if (user.avatar?.public_id) {
    await cloudinaryFileRemove(user.avatar.public_id);
  }

  await User.findByIdAndDelete(req.user._id);

  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Account deleted successfully",
  });
});
