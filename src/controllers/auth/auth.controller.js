/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 * @description Standardized API response formatter
 */

// External dependencies first
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";

// Model config
import User from "../../models/user.model.js";
import TokenBlacklist from "../../models/tokenBlacklist.model.js";
import logger from "../../logger/winston.logger.js";

// Cloudinary config
import {
  uploadFileToCloudinary,
  removeFileToCloudinary,
} from "../../config/cloudinary.config.js";

// Constant config
import {
  MAX_LOGIN_ATTEMPTS,
  REFRESH_TOKEN_SECRET,
  OPTIONS,
} from "../../constants/constant.js";

// Middleware config
import asyncHandler from "../../middleware/asyncHandler.middleware.js";

// Application config
import blacklistToken from "../../utils/tokenBlacklist.js";
import generateOTP from "../../utils/otp.js";
import sendEmail from "../../utils/email.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";

// Generate Tokens
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to generate tokens"
    );
  }
};

// Register User
export const register = asyncHandler(async (req, res) => {
  // Destructure with proper variable name
  const {
    fullName,
    email,
    userName,
    password,
    phone,
    addresses = [],
  } = req.body;

  // Validate required fields
  if (
    [fullName, email, userName, password, phone].some((field) => !field?.trim())
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Full Name, Email, Username, Phone Number, and Password are required."
    );
  }

  // Validating Exit Users
  const existedUser = await User.findOne({
    $or: [{ userName }, { email }, { phone }],
  });

  if (existedUser) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      "Username or Email already in use."
    );
  }

  // Handle avatar upload
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar file is required");
  }

  // Avatar send to Cloudinary
  const avatar = await uploadFileToCloudinary(avatarLocalPath);

  if (!avatar) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar file upload failed");
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  // Create user
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

  // Send verification email
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
    await removeFileToCloudinary(avatar.public_id);
    await User.findByIdAndDelete(user._id);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to send verification email"
    );
  }

  // Return proper response
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
    "Registration successful. Please check your email to verify your account."
  ).send(res);
});

// Verify email with OTP
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp)
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email and OTP are required");

  const user = await User.findOne({
    email,
    otp: { $exists: true },
    otpExpiry: { $gt: Date.now() },
  }).select("+otp +otpExpiry");

  if (!user)
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid or expired OTP");

  const isValid = await user.compareOTP(otp);

  if (!isValid) throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid OTP");

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return ApiResponse.success(
    StatusCodes.OK,
    "Email verified successfully."
  ).send(res);
});

// Login User
export const login = asyncHandler(async (req, res) => {
  const { email, userName, password, phone } = req.body;

  if (!password && [!email || !userName || !phone]) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Password is required, and either Username, Email, or Phone No must be provided."
    );
  }

  const user = await User.findOne({
    $or: [{ email }, { userName }, { phone }],
  }).select("+password +refreshToken +loginAttempts +lockUntil");

  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid credentials");
  }

  if (user.isLocked()) {
    const remainingTime = Math.ceil(
      (user.lockUntil - Date.now()) / (60 * 1000)
    );
    throw new ApiError(
      StatusCodes.TOO_MANY_REQUESTS,
      `Account temporarily locked. Try again in ${remainingTime} minutes.`
    );
  }

  if (!user.isVerified) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      "Please verify your email first"
    );
  }

  const isValid = await user.comparePassword(password);

  if (!isValid) {
    await user.incrementLoginAttempts();
    const attemptsLeft = MAX_LOGIN_ATTEMPTS - (user.loginAttempts + 1);
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      attemptsLeft > 0
        ? `Invalid credentials. ${attemptsLeft} attempts left`
        : "Account locked for 30 minutes"
    );
  }

  if (user.loginAttempts > 0 || user.lockUntil) {
    await user.resetLoginAttempts();
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  res
    .cookie("accessToken", accessToken, OPTIONS)
    .cookie("refreshToken", refreshToken, OPTIONS);

  return new ApiResponse(
    StatusCodes.OK,
    {
      id: user._id,
      fullName: user.fullName,
      userName: user.userName,
      email: user.email,
      avatar: user.avatar?.url,
      role: user.role,
      phone: user.pnone,
      address: user.address,
      isVerified: user.isVerified,
      accessToken,
      refreshToken,
    },
    "User logged in successfully"
  ).send(res);
});

// Forgot Password User
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email is required.");
  }

  const user = await User.findOne({ email });

  if (!user) {
    return new ApiResponse(
      StatusCodes.OK,
      "If an account exists with this email, a reset OTP has been sent."
    );
  }

  const resetOTP = generateOTP();
  const resetOTPExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.resetPasswordOTP = await user.hashOTP(resetOTP);
  user.resetPasswordExpiresAt = resetOTPExpiresAt;

  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      to: user.email,
      subject: "passwordReset Reset OTP",
      template: "passwordReset",
      context: {
        name: user.fullName,
        otp: resetOTP,
        expiresIn: "10 minutes",
      },
    });
  } catch (error) {
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to send reset OTP"
    );
  }

  return new ApiResponse(
    StatusCodes.OK,
    "If an account exists with this email, a reset OTP has been sent."
  ).send(res);
});

// Reset Password User
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if ([email, otp, newPassword].some((field) => !field)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Email, OTP, and New Password are required."
    );
  }

  const user = await User.findOne({
    email,
    resetPasswordOTP: { $exists: true },
    resetPasswordExpiresAt: { $gt: Date.now() },
  }).select("+resetPasswordOTP +resetPasswordExpiresAt");

  if (!user) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Invalid or expired OTP. Please request a new one."
    );
  }

  const isValid = await user.resetCompareOTP(otp);

  if (!isValid) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid OTP");
  }

  const isBlacklisted = await TokenBlacklist.findOne({
    token: otp,
    type: "reset",
  });

  if (isBlacklisted) {
    throw new ApiError(StatusCodes.CONFLICT, "This OTP has already been used");
  }

  user.password = newPassword;
  user.resetPasswordOTP = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();

  await TokenBlacklist.create({ token: otp, type: "reset", userId: user._id });

  try {
    await sendEmail({
      to: user.email,
      subject: "Password Changed Successfully",
      template: "passwordChanged",
      context: {
        name: user.fullName,
        timestamp: new Date().toLocaleString(),
      },
    });
  } catch (error) {
    logger.error(`Email confirmation failed for ${user.email}`);
  }

  return new ApiResponse(
    StatusCodes.OK,
    "Password reset successfully. You can now login with your new password."
  ).send(res);
});

// Logout User
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Refresh token is required.");
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

    await blacklistToken(
      refreshToken,
      "refresh",
      decoded._id,
      7 * 24 * 60 * 60
    );
  } catch (error) {
    logger.error(`Error during logout:, ${error}`);
  }

  res.clearCookie("accessToken", OPTIONS).clearCookie("refreshToken", OPTIONS);

  return new ApiResponse(StatusCodes.OK, "Logged out successfully.").send(res);
});

// Resend verification email
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email is required");
  }

  const user = await User.findOne({ email }).select("+otp +otpExpiry");

  if (!user) {
    return new ApiResponse(
      StatusCodes.OK,
      "If an account exists with this email, a verification OTP has been sent."
    );
  }

  if (user.isVerified) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email is already verified");
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  user.otp = await user.hashOTP(otp);
  user.otpExpiry = otpExpiry;

  await user.save({ validateBeforeSave: false });

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
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to send verification email"
    );
  }

  return new ApiResponse(
    StatusCodes.OK,
    "If an account exists with this email, a verification OTP has been sent."
  ).send(res);
});

// Refresh Token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized request");
  }

  try {
    const decoded = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET);

    const isBlacklisted = await TokenBlacklist.findOne({
      token: incomingRefreshToken,
      type: "refresh",
    });

    if (isBlacklisted)
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Token has been invalidated"
      );

    const user = await User.findById(decoded._id).select("+refreshToken");

    if (!user)
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");

    if (incomingRefreshToken !== user?.refreshToken)
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Refresh token is expired or already used"
      );

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    await TokenBlacklist.create({
      token: incomingRefreshToken,
      type: "refresh",
      userId: user._id,
    });

    res
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions);

    return ApiResponse.success(
      StatusCodes.OK,
      {
        id: user._id,
        fullName: user.fullName,
        userName: user.userName,
        email: user.email,
        avatar: user.avatar?.url,
      },
      "Tokens refreshed successfully."
    ).send(res);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      await redisClient.del(`refreshToken:${decoded?._id}`);
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Refresh token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
    }
    throw error;
  }
});
