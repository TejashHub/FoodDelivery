/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import User from "../../models/user.model.js";
import { TokenBlacklist } from "../../models/user.model.js";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../errors/ApiError.js";

export const getAllUsers = async (req, res) => {
  const { page = 1, limit = 10, search = "", role = "" } = req.query;
  const query = {
    $or: [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { userName: { $regex: search, $options: "i" } },
    ],
  };
  if (role) {
    query.role = role;
  }
  const users = await User.find(query)
    .select("-password -refreshToken -otp -otpExpiry -twoFactorSecret")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  const totalUsers = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    users,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: Number(page),
  });
};

export const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "-password -refreshToken -otp -otpExpiry -twoFactorSecret"
  );
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
  }
  res.status(200).json({
    success: true,
    data: user,
  });
};

export const updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin", "moderator"].includes(role)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid role specified");
  }
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You cannot change your own role"
    );
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  ).select("-password -refreshToken -otp -otpExpiry -twoFactorSecret");

  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
  }
  res.status(200).json({ message: "User role updated successfully", user });
};

export const toggleUserStatus = async (req, res) => {
  if (req.params.id === req.user._id.toString(req, res)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You cannot deactivate your own account"
    );
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
  }

  user.isActive = !user.isActive;
  await user.save();

  if (!user.isActive) {
    await TokenBlacklist.deleteMany({ userId: user._id });
    user.tokenVersion += 1;
    await user.save();
  }
  const status = user.isActive ? "activated" : "deactivated";
  res.status(200).json({ message: `User ${status} successfully` });
};

export const deleteUser = async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You cannot delete your own account"
    );
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
  }
  await TokenBlacklist.deleteMany({ userId: user._id });
  res.status(200).json({ message: "User deleted successfully" });
};

export const impersonateUser = async (req, res) => {
  if (req.user.role !== "admin") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Only admins can impersonate users"
    );
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
  }
  if (!user.isActive) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot impersonate inactive user"
    );
  }
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save();
  res.status(200).json({
    message: "Impersonation successful",
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
};

export const getSystemStats = async (req, res) => {
  const [totalUsers, activeUsers, admins, moderators] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ role: "moderator" }),
  ]);
  res.status(200).json({
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers,
    admins,
    moderators,
    regularUsers: totalUsers - admins - moderators,
  });
};
