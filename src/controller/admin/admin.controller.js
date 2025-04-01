/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import User from "../models/user.model.js";
import { ApiError } from "../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import { cloudinaryFileRemove } from "../utils/cloudinary.js";
import { asyncHandler } from "../../middleware/asyncHandler.middleware.js";

export const promoteToAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (user.role === "admin") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User is already an admin");
  }

  user.role = "admin";
  await user.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User promoted to admin successfully",
    data: {
      id: user._id,
      userName: user.userName,
      email: user.email,
      role: user.role,
    },
  });
});

export const getAlUser = asyncHandler(async (req, res) => {
  const { query, page = 1, limit = 10 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, parseInt(limit, 10));
  const skip = (pageNum - 1) * limitNum;

  const searchCondition = query
    ? {
        $or: [
          { fullName: { $regex: query, $options: "i" } },
          { userName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      }
    : {};

  const users = await User.find(searchCondition)
    .select("-password -refreshToken -resetPasswordToken -otp")
    .limit(limitNum)
    .skip(skip);

  const totalUsers = await User.countDocuments(searchCondition);

  return res.status(StatusCodes.OK).json({
    success: true,
    total: totalUsers,
    page: pageNum,
    limit: limitNum,
    data: users,
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(id).select(
    "-password -refreshToken -resetPasswordToken -otp"
  );

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }
  return res.status(StatusCodes.OK).json({
    success: true,
    data: user,
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fullName, userName, role } = req.body;
  const user = await User.findByIdAndUpdate(
    id,
    { fullName, userName, role },
    { new: true }
  );
  if (!user) throw new NotFoundError("User not found.");

  return res
    .status(StatusCodes.OK)
    .json({ message: "User updated successfully.", user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (user.avatar?.public_id) {
    await cloudinaryFileRemove(user.avatar.public_id);
  }

  await User.findByIdAndDelete(id);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User deleted successfully",
    data: {
      id: user._id,
      userName: user.userName,
      email: user.email,
    },
  });
});
