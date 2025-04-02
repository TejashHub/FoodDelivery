/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import User from "../../model/user.model.js";
import Admin from "../../model/admin.model.js";
import { ApiError } from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import { cloudinaryFileRemove } from "../../utils/cloudinary.js";
import asyncHandler from "../../middleware/asyncHandler.middleware.js";

export const promoteToAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { accessLevel = "support", permissions, regions } = req.body;

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

  const admin = new Admin({
    user: id,
    accessLevel,
    assignedRegions: accessLevel === "regional" ? regions || [] : [],
  });

  if (permissions) {
    admin.permissions = { ...admin.permissions, ...permissions };
  }

  await admin.save();
  await admin.logActivity("Admin promotion", req.ip);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User promoted to admin successfully",
    data: {
      id: user._id,
      userName: user.userName,
      email: user.email,
      role: "admin",
      adminId: admin.adminId,
      accessLevel: admin.accessLevel,
    },
  });
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { query, page = 1, limit = 10, role } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, parseInt(limit, 10));
  const skip = (pageNum - 1) * limitNum;

  const searchCondition = {};

  if (query) {
    searchCondition.$or = [
      { fullName: { $regex: query, $options: "i" } },
      { userName: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
    ];
  }

  if (role) {
    searchCondition.role = role;
  }

  const [users, total] = await Promise.all([
    User.find(searchCondition)
      .select("-password -refreshToken -resetPasswordToken -otp")
      .limit(limitNum)
      .skip(skip)
      .lean(),
    User.countDocuments(searchCondition),
  ]);

  const totalUsers = await User.countDocuments(searchCondition);

  return res.status(StatusCodes.OK).json({
    success: true,
    total,
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
    "-password -refreshToken -resetPasswordOTP -otp"
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

  const updates = {};

  if (fullName) updates.fullName = fullName;
  if (userName) updates.userName = userName;
  if (role) updates.role = role;

  const user = await User.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  }).select("-password -refreshToken");

  if (!user) throw new NotFoundError("User not found.");

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "User updated successfully",
    data: user,
  });
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

  if (user.role === "admin") {
    await Admin.findOneAndDelete({ user: id });
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

export const getAdminDetails = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id)
    .populate("user", "fullName email avatar")
    .select("-activityLog");

  if (!admin) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Admin not found");
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    data: admin,
  });
});

export const updateAdminDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permissions, accessLevel, regions } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid admin ID");
  }

  const updates = {};
  if (permissions) updates.permissions = permissions;
  if (accessLevel) updates.accessLevel = accessLevel;
  if (regions) updates.assignedRegions = regions;

  const admin = await Admin.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  }).populate("user", "fullName email");

  if (!admin) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Admin not found");
  }

  await admin.logActivity("Permissions updated", req.ip, { updates });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Admin permissions updated successfully",
    data: admin,
  });
});
