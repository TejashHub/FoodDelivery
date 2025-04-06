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

// Utils
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

export const adminController = {
  // Get all users with pagination, search, and filter
  getAllUsers: asyncHandler(async (req, res) => {
    const {
      search,
      page = 1,
      limit = 10,
      fields = "fullName, userName, email, phone, role, isVerified addresses",
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
    const {
      fullName,
      email,
      userName,
      password,
      phone,
      addresses = [],
    } = req.body;

    // Validate that required fields are provided
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

    // Check if the username, email, or phone already exists in the database
    const existedUser = await User.findOne({
      $or: [{ userName }, { email }, { phone }],
    });

    if (existedUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Username or Email already in use."
      );
    }

    // Handle the file upload for avatar (profile picture)
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar file is required");
    }

    // Securely upload the avatar to Cloudinary or similar storage
    const avatar = await uploadFileToCloudinary(avatarLocalPath);

    if (!avatar) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar file upload failed");
    }

    // Generate an OTP for email verification with an expiry time
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Create a new user in the database, including the uploaded avatar and OTP
    const user = await User.create({
      fullName,
      email,
      userName,
      password,
      phone,
      avatar: { public_id: avatar.public_id, url: avatar.secure_url },
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

    // Try sending a verification email with the OTP to the user
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
      // If email fails, clean up resources (delete user and avatar)
      await removeFileToCloudinary(avatar.public_id);
      await User.findByIdAndDelete(user._id);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to send verification email"
      );
    }

    // Respond with the created user info (excluding sensitive data like password)
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
      "User created successfully by admin. Please check your email to verify your account."
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

    const user = await User.findById(id).select(
      "fullName userName email phone role isVerified addresses"
    );

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

  // Check the system's health (e.g., uptime, memory, DB status)
  systemHealthCheck: asyncHandler(async (req, res) => {
    const uptime = os.uptime();
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();

    const isDatabaseConnected = true; // Ideally, should check DB connection status here

    // Return system health metrics
    return new ApiResponse(
      StatusCodes.OK,
      { uptime, freeMemory, totalMemory, isDatabaseConnected },
      "System health check successful"
    ).send(res);
  }),

  // Fetch the server logs from a specific log file
  getServerLogs: asyncHandler(async (req, res) => {
    const logsFilePath = path.join(__dirname, "logs", "server.log");

    fs.readFile(logsFilePath, "utf8", (error, data) => {
      if (error) {
        throw new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Error reading logs"
        );
      }

      // Respond with the logs data
      return new ApiResponse(
        StatusCodes.OK,
        { logs: data },
        "Server logs fetched successfully"
      ).send(res);
    });
  }),

  // Initiate a database backup
  initiateDatabaseBackup: asyncHandler(async (req, res) => {
    const backupPath = "/path/to/backup/directory";

    exec(`mongodump --out ${backupPath}`, (error, stdout, stderr) => {
      if (error) {
        throw new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Database backup failed"
        );
      }

      return new ApiResponse(
        StatusCodes.OK,
        { message: "Database backup successful" },
        "Database backup initiated successfully"
      ).send(res);
    });
  }),
};
