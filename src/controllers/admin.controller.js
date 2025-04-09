// System Module
import os from "os";
import path from "path";
import fs from "fs";
import { exec } from "child_process";

// Database
import mongoose from "mongoose";

// External Package
import { StatusCodes } from "http-status-codes";

// Model
import User from "../models/user.model.js";

// Middleware
import asyncHandler from "../middleware/asyncHandler.middleware.js";

// Clodinary
import {
  uploadFileToCloudinary,
  removeFileToCloudinary,
} from "../config/cloudinary.config.js";

// Utils
import sendEmail from "../utils/email.js";
import generateOTP from "../utils/otp.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

export const adminController = {
  // Get all users with pagination, search, and filter
  getAllUsers: asyncHandler(async (req, res) => {
    const {
      search,
      page = 1,
      limit = 10,
      fields = "fullName userName email  phone  role isVerified addresses",
    } = req.query;

    const filter = {};

    // If search query is provided, apply filters to the database search
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
        { role: { $regex: search, $options: "i" } },
        { isVerified: { $regex: search, $options: "i" } },
      ];
    }

    const selectFields = fields.split(",").join(" ");
    const pageNumber = parseInt(page, 10);
    const pageLimit = parseInt(limit, 10);

    // Validate the pagination query parameters
    if (pageNumber < 1) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Page number must be greater than 0."
      );
    }

    if (pageLimit < 1 || pageLimit > 100) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Limit must be between 1 and 100."
      );
    }

    // Fetch users with pagination, filters, and selected fields
    const users = await User.find(filter)
      .select(selectFields)
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit);

    const totalUsers = await User.countDocuments(filter);

    // Respond with paginated data, total user count, and current page info
    return new ApiResponse(
      StatusCodes.OK,
      { data: users, total: totalUsers, page: pageNumber, limit: pageLimit },
      "All data fetched successfully"
    ).send(res);
  }),

  // Get user details by user ID
  getUserDetails: asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate the provided user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid User ID");
    }

    const user = await User.findById(id).select(
      "fullName userName email phone role isVerified addresses"
    );

    // If user not found, return an error
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Respond with the found user details
    return new ApiResponse(
      StatusCodes.OK,
      { data: user },
      "User details fetched successfully"
    ).send(res);
  }),

  // Create a new user by admin
  createUser: asyncHandler(async (req, res) => {
    // Input Validation - Essential fields check
    const {
      fullName,
      email,
      userName,
      password,
      phone,
      addresses = [],
    } = req.body;

    // Required Fields Verification
    if (
      [fullName, email, userName, password, phone].some(
        (field) => !field?.trim()
      )
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Full Name, Email, Username, Phone Number, and Password are required."
      );
    }

    // Existing User Check - Prevent duplicate accounts
    const existedUser = await User.findOne({
      $or: [{ userName }, { email }, { phone }],
    });

    if (existedUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Username or Email already in use."
      );
    }

    // Avatar Handling - Mandatory profile image
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar file is required");
    }

    // Secure Cloud Upload
    const avatar = await uploadFileToCloudinary(avatarLocalPath);

    if (!avatar) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar file upload failed");
    }

    // OTP Generation - Cryptographic security
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // User Creation - Password hashing should be in model hooks
    const user = await User.create({
      fullName,
      email,
      userName,
      password,
      phone,
      avatar: {
        public_id: avatar.public_id,
        url: avatar.secure_url,
      },
      addresses: addresses.map((addr) => ({
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        latitude: addr.latitude || null,
        longitude: addr.longitude || null,
        isDefault: addr.isDefault || false,
      })),
      otp,
      otpExpiry,
    });

    // Email Verification Flow
    try {
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email",
        template: "emailVerification",
        context: {
          name: user.fullName,
          otp,
          expiresIn: "10 minutes",
        },
      });
    } catch (error) {
      // Cleanup on Failure - Atomic transaction
      await removeFileToCloudinary(avatar.public_id);
      await User.findByIdAndDelete(user._id);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to send verification email"
      );
    }

    return new ApiResponse(
      StatusCodes.OK,
      {
        fullName: user.fullName,
        userName: user.userName,
        email: user.email,
        avatar: user.avatar?.url,
        phone: user.phone,
        addresses: user.addresses,
      },
      "User created by admin. Please check your email to verify your account."
    ).send(res);
  }),

  // Update User Profile
  updateUser: asyncHandler(async (req, res) => {
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
    if (
      usernameExists &&
      usernameExists._id.toString() !== user._id.toString()
    ) {
      throw new ApiError(StatusCodes.CONFLICT, "Username already taken");
    }

    // Prepare the data to be updated
    const updatedData = { fullName, userName, email, phone };

    // Add new addresses, but limit to 5 most recent ones
    if (addresses.length > 0) {
      updatedData.addresses = [...user.addresses, ...addresses].slice(-5);
    }

    // Update user profile in the database with new data
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updatedData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password -refreshToken");

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
  }),

  // Upload / Change User Avatar
  updateAvatar: asyncHandler(async (req, res) => {
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
  }),

  // Delete a user (requires password verification)
  deleteUser: asyncHandler(async (req, res) => {
    const { password } = req.body;

    if (!password) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Password is required");
    }

    // Verify the password of the currently logged-in user
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Validate the password for deletion
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid password");
    }

    // Prevent deletion of admin accounts
    if (user.role === "admin") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Admin accounts cannot be deleted"
      );
    }

    // Remove the avatar if it exists
    const avatarUrl = user.avatar?.url;
    if (avatarUrl) {
      await removeFileToCloudinary(avatarUrl);
    }

    // Delete the user from the database
    await User.findByIdAndDelete(user._id);

    // Clear authentication cookies
    res
      .clearCookie("accessToken", OPTIONS)
      .clearCookie("refreshToken", OPTIONS);

    // Respond with a success message after deletion
    return new ApiResponse(
      StatusCodes.OK,
      null,
      "Account deleted successfully"
    ).send(res);
  }),

  // Change a user's role (admin can only change roles to "admin" or "user")
  changeUserRole: asyncHandler(async (req, res) => {
    const { role } = req.body;
    const { id } = req.params;

    // Validate the user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid id");
    }

    const user = await User.findById(id);

    // If user not found, return error
    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "User not found");
    }

    // Ensure only admin users can change roles
    if (req.user.role !== "admin") {
      throw new ApiError(StatusCodes.FORBIDDEN, "Only admins can change roles");
    }

    // Validate the role value
    if (!["admin", "user"].includes(role)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid role");
    }

    user.role = role;
    await user.save();

    // Respond with the updated user role
    return new ApiResponse(
      StatusCodes.OK,
      { role: user.role },
      "User role updated successfully"
    ).send(res);
  }),

  // Change a user's active status
  changeUserStatus: asyncHandler(async (req, res) => {
    const { isActive } = req.body;
    const { id } = req.params;

    // Validate the user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid ID");
    }

    // Find the user by ID
    const user = await User.findById(id).select(
      "fullName userName email phone role isVerified addresses isActive"
    );

    // If user not found, return error
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Ensure only admins can change user status
    if (req.user.role !== "admin") {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Only admins can change user status"
      );
    }

    // Validate the isActive status
    if (![true, false].includes(isActive)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid Active Status");
    }

    // Update the user's active status
    user.isActive = isActive;
    await user.save();

    // Respond with the updated status
    return new ApiResponse(
      StatusCodes.OK,
      { isActive: user.isActive },
      "User status updated successfully"
    ).send(res);
  }),

  // Fetch user growth metrics for a given period
  getUserGrowthMetrics: asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Fetch the new users count in the given date range
    const newUsersCount = await User.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });

    // Fetch the new users count from the previous month
    const previousStart = new Date(start);
    previousStart.setMonth(previousStart.getMonth() - 1);

    const previousEnd = new Date(start);
    previousEnd.setMonth(previousEnd.getMonth() - 1);

    const previousPeriodCount = await User.countDocuments({
      createdAt: { $gt: previousStart, $lte: previousEnd },
    });

    let growthRate = 0;
    if (previousPeriodCount > 0) {
      growthRate =
        ((newUsersCount - previousPeriodCount) / previousPeriodCount) * 100;
    }

    // Respond with the growth rate data
    return new ApiResponse(
      StatusCodes.OK,
      {
        newUsersCount,
        previousPeriodCount,
        growthRate,
        startDate: start,
        endDate: end,
      },
      "User growth metrics fetched successfully"
    ).send(res);
  }),
};
