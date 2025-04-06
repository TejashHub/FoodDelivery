/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 * @description User controller handling profile retrieval, profile update, avatar update,
 *              password change, and account deletion functionalities.
 */

import { StatusCodes } from "http-status-codes";

import User from "../models/user.model.js";

import {
  uploadFileToCloudinary,
  removeFileToCloudinary,
} from "../config/cloudinary.config.js";

import asyncHandler from "../middleware/asyncHandler.middleware.js";

import { OPTIONS } from "../constants/constant.js";

import sendEmail from "../utils/email.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import logger from "../logger/winston.logger.js";

// Get Logged-in User Profile
export const getProfile = asyncHandler(async (req, res) => {
  // Fetch the logged-in user's profile excluding password and sensitive fields
  const user = await User.findById(req.user._id).select(
    "fullName email phone addresses role isVerified"
  );

  if (!user) {
    // If no user is found, throw an error
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  // Return the user's profile data with a success message
  return new ApiResponse(
    StatusCodes.OK,
    { data: user },
    "User profile retrieved successfully"
  ).send(res);
});

// Update User Profile
export const updateProfile = asyncHandler(async (req, res) => {
  // Destructure user input from the request body
  const { fullName, userName, email, phone, addresses = [] } = req.body;

  // Validate address fields - ensure each address has required fields
  addresses.forEach((addr) => {
    if (!addr.street || !addr.city || !addr.postalCode) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Each address must have street, city, and postalCode"
      );
    }
  });

  // Fetch the current user's profile
  const user = await User.findById(req.user._id).select(
    "-password -refreshToken"
  );
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

  // Prevent duplicate email or username
  const emailExists = await User.findOne({ email });
  if (emailExists && emailExists._id.toString() !== user._id.toString()) {
    throw new ApiError(StatusCodes.CONFLICT, "Email already in use");
  }

  const usernameExists = await User.findOne({ userName });
  if (usernameExists && usernameExists._id.toString() !== user._id.toString()) {
    throw new ApiError(StatusCodes.CONFLICT, "Username already taken");
  }

  // Prepare the data to be updated
  const updatedData = { fullName, userName, email, phone };

  // Add new addresses, but limit to 5 most recent ones
  if (addresses.length > 0) {
    updatedData.addresses = [...user.addresses, ...addresses].slice(-5);
  }

  // Update user profile in the database with new data
  const updatedUser = await User.findByIdAndUpdate(req.user._id, updatedData, {
    new: true,
    runValidators: true,
  }).select("-password -refreshToken");

  // Return the updated user data in response
  return new ApiResponse(
    StatusCodes.OK,
    {
      data: {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        userName: updatedUser.userName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        addresses: updatedUser.addresses,
        avatar: updatedUser.avatar?.url,
      },
    },
    "Profile updated successfully"
  ).send(res);
});

// Upload / Change User Avatar
export const updateAvatar = asyncHandler(async (req, res) => {
  // Fetch the current user's profile from the database
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

  // Get the file path of the uploaded avatar
  const avatarPath = req.file?.path;
  if (!avatarPath) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar image required");
  }

  // Upload the avatar image to Cloudinary and get its URL
  const avatar = await uploadFileToCloudinary(avatarPath);
  if (!avatar) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar upload failed");
  }

  // Update the user's avatar field in the database with Cloudinary info
  user.avatar = {
    public_id: avatar.public_id,
    url: avatar.secure_url,
  };

  await user.save();

  // Return the updated avatar information in response
  return new ApiResponse(
    StatusCodes.OK,
    { avatar: user.avatar },
    "Avatar updated"
  ).send(res);
});

// Change User Password
export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // Check if new password is different from the old one
  if (oldPassword === newPassword) {
    throw new ApiError(StatusCodes.CONFLICT, "New password must be different");
  }

  // Fetch the current user and include the password field
  const user = await User.findById(req.user._id).select("+password");
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

  // Validate the old password
  const isValid = await user.comparePassword(oldPassword);
  if (!isValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid current password");
  }

  // Set the new password and save it in the database
  user.password = newPassword;
  await user.save();

  // Send an email notification about the password change
  try {
    await sendEmail({
      to: user.email,
      subject: "Security Alert: Password Changed",
      template: "passwordChanged",
      context: {
        name: user.fullName,
        timestamp: new Date().toLocaleString(),
        device: req.headers["user-agent"],
      },
    });
  } catch (err) {
    // Log any error that occurs while sending the email
    logger.error(`Password change email failed: ${err}`);
  }

  // Return a success message after the password change
  return new ApiResponse(
    StatusCodes.OK,
    null,
    "Password changed successfully"
  ).send(res);
});

// Delete User Account
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  // Ensure the user provides the correct password for account deletion
  if (!password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Password is required");
  }

  // Fetch the current user and include the password field for validation
  const user = await User.findById(req.user._id).select("+password");
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

  // Validate the provided password
  const isValid = await user.comparePassword(password);
  if (!isValid) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid password");
  }

  // If the user has an avatar, remove it from Cloudinary
  const avatarUrl = user.avatar?.url;
  if (avatarUrl) {
    await removeFileToCloudinary(avatarUrl);
  }

  // Delete the user from the database
  await User.findByIdAndDelete(user._id);

  // Clear authentication cookies
  res.clearCookie("accessToken", OPTIONS).clearCookie("refreshToken", OPTIONS);

  // Return a success message after account deletion
  return new ApiResponse(
    StatusCodes.OK,
    null,
    "Account deleted successfully"
  ).send(res);
});
