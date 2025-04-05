/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import User from "../../models/user.model.js";
import TokenBlacklist from "../../models/tokenBlacklist.model.js";
import AuditLog from "../../models/auditLog.model.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import redisClient from "../../config/redis.config.js";
import { ROLES, MAX_PAGINATION_LIMIT } from "../../constants/constant.js";
import asyncHandler from "../../middleware/asyncHandler.middleware.js";

// Helper functions
const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const handleTransactions = async (operations) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await operations(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(
    MAX_PAGINATION_LIMIT,
    Math.max(1, parseInt(req.query.limit) || 10)
  );
  const search = req.query.search?.trim() || "";
  const role = ROLES.includes(req.query.role) ? req.query.role : "";

  const query = {
    ...(role && { role }),
    $or: [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { userName: { $regex: search, $options: "i" } },
    ],
  };

  const [users, totalUsers] = await Promise.all([
    User.find(query)
      .select("-password -refreshToken -otp -otpExpiry -twoFactorSecret")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments(query),
  ]);

  return new ApiResponse(
    StatusCodes.OK,
    {
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
    },
    "Users retrieved successfully"
  ).send(res);
});

export const getUserById = asyncHandler(async (req, res) => {
  if (!validateObjectId(req.params.id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID format");
  }

  const user = await User.findById(req.params.id).select(
    "-password -refreshToken -otp -otpExpiry -twoFactorSecret"
  );

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  return new ApiResponse(
    StatusCodes.OK,
    user,
    "User retrieved successfully"
  ).send(res);
});

export const updateUserRole = asyncHandler(async (req, res) => {
  if (!validateObjectId(req.params.id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID format");
  }

  const { role } = req.body;
  if (!ROLES.includes(role)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid role specified");
  }

  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Cannot change your own role");
  }

  const user = await handleTransactions(async (session) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true, session }
    ).select("-password -refreshToken -otp -otpExpiry -twoFactorSecret");

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    await AuditLog.create(
      [
        {
          action: "ROLE_UPDATE",
          performedBy: req.user._id,
          targetUser: user._id,
          previousState: { role: user.role },
          newState: { role },
        },
      ],
      { session }
    );

    return user;
  });

  return new ApiResponse(
    StatusCodes.OK,
    user,
    "User role updated successfully"
  ).send(res);
});

export const toggleUserStatus = asyncHandler(async (req, res) => {
  if (!validateObjectId(req.params.id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID format");
  }

  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Cannot modify your own status");
  }

  const result = await handleTransactions(async (session) => {
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    const newStatus = !user.isActive;
    user.isActive = newStatus;

    if (!newStatus) {
      await TokenBlacklist.deleteMany({ userId: user._id }).session(session);
      user.tokenVersion += 1;
    }

    await user.save({ session });

    await AuditLog.create(
      [
        {
          action: newStatus ? "USER_ACTIVATED" : "USER_DEACTIVATED",
          performedBy: req.user._id,
          targetUser: user._id,
        },
      ],
      { session }
    );

    return { newStatus, userId: user._id };
  });

  return new ApiResponse(
    StatusCodes.OK,
    { userId: result.userId, isActive: result.newStatus },
    `User ${result.newStatus ? "activated" : "deactivated"} successfully`
  ).send(res);
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (!validateObjectId(req.params.id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID format");
  }

  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Cannot delete your own account");
  }

  await handleTransactions(async (session) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true, session }
    );

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    await TokenBlacklist.deleteMany({ userId: user._id }).session(session);
    await AuditLog.create(
      [
        {
          action: "USER_DELETED",
          performedBy: req.user._id,
          targetUser: user._id,
        },
      ],
      { session }
    );
  });

  return new ApiResponse(
    StatusCodes.OK,
    null,
    "User marked for deletion successfully"
  ).send(res);
});

export const impersonateUser = asyncHandler(async (req, res) => {
  if (!validateObjectId(req.params.id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID format");
  }

  if (req.user.role !== "admin") {
    throw new ApiError(StatusCodes.FORBIDDEN, "Insufficient privileges");
  }

  const result = await handleTransactions(async (session) => {
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (!user.isActive) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Cannot impersonate inactive user"
      );
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ session });

    await AuditLog.create(
      [
        {
          action: "IMPERSONATION_START",
          performedBy: req.user._id,
          targetUser: user._id,
          metadata: { accessToken: accessToken.slice(-10) },
        },
      ],
      { session }
    );

    return { accessToken, refreshToken, user };
  });

  return new ApiResponse(
    StatusCodes.OK,
    {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        _id: result.user._id,
        fullName: result.user.fullName,
        email: result.user.email,
        role: result.user.role,
        isActive: result.user.isActive,
      },
    },
    "Impersonation session started"
  ).send(res);
});

export const getSystemStats = asyncHandler(async (req, res) => {
  const CACHE_KEY = "system_stats";

  const cache = await redisClient.get(CACHE_KEY);

  if (cache) {
    return new ApiResponse(
      StatusCodes.OK,
      JSON.parse(cache),
      "System statistics (cached)"
    ).send(res);
  }

  const stats = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ role: "moderator" }),
    User.countDocuments({ isDeleted: true }),
  ]);

  const responseData = {
    totalUsers: stats[0],
    activeUsers: stats[1],
    admins: stats[2],
    moderators: stats[3],
    deletedUsers: stats[4],
    regularUsers: stats[0] - stats[2] - stats[3],
  };

  await redisClient.set(CACHE_KEY, JSON.stringify(responseData), "EX", 300);

  return new ApiResponse(
    StatusCodes.OK,
    responseData,
    "System statistics"
  ).send(res);
});
