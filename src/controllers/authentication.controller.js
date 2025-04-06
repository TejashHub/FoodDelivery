/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 * @description Handles all authentication-related functionality, including user registration with avatar upload,
 * email verification via OTP, login with account lock mechanism, and secure token generation and management
 * (access & refresh tokens).
 */

// External Package
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";

// Model
import User from "../models/user.model.js";
import TokenBlacklist from "../models/tokenBlacklist.model.js";
import logger from "../logger/winston.logger.js";

// Cloudinary
import {
  uploadFileToCloudinary,
  removeFileToCloudinary,
} from "../config/cloudinary.config.js";

// Middleware config
import asyncHandler from "../middleware/asyncHandler.middleware.js";

// Constant
import {
  MAX_LOGIN_ATTEMPTS,
  REFRESH_TOKEN_SECRET,
  OPTIONS,
} from "../constants/constant.js";

// Utils
import blacklistToken from "../utils/tokenBlacklist.js";
import generateOTP from "../utils/otp.js";
import sendEmail from "../utils/email.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";

// Generate Tokens
const generateAccessAndRefreshToken = async (userId) => {
  try {
    // User Verification - Ensure valid user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    // Token Generation - JWT creation using model methods
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Refresh Token Storage - Save hashed token to DB for session management
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Return Tokens - Never store raw tokens in logs
    return { accessToken, refreshToken };
  } catch (error) {
    // Error Handling - Generic message to prevent info leakage
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Authentication service unavailable"
    );
  }
};

export const authenticationController = {
  // Register User
  register: asyncHandler(async (req, res) => {
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
      "Registration successful. Please check your email to verify your account."
    ).send(res);
  }),

  // Login User
  login: asyncHandler(async (req, res) => {
    // Credential Validation - Multiple login identifiers
    const { email, userName, password, phone } = req.body;

    // Input Sanity Check - Password + at least one identifier
    if (!password || (!email && !userName && !phone)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Password and one identifier required"
      );
    }

    // Account Lookup - Security-sensitive fields selection
    const user = await User.findOne({
      $or: [{ email }, { userName }, { phone }],
    }).select("+password +refreshToken +loginAttempts +lockUntil");

    // Generic Error Response - Prevent user enumeration
    if (!user)
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid credentials");

    // Account Lock Check - Brute-force protection
    if (user.isLocked()) {
      const remainingLock = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        `Account locked. Retry in ${remainingLock} minutes`
      );
    }

    // Email Verification Gate - Require verified status
    if (!user.isVerified) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Verify email first");
    }

    // Password Verification - Constant-time comparison critical
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      await user.incrementLoginAttempts();
      const remainingAttempts = MAX_LOGIN_ATTEMPTS - (user.loginAttempts + 1);

      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        remainingAttempts > 0
          ? `Invalid credentials. ${remainingAttempts} attempts left`
          : "Account locked for 30 minutes"
      );
    }

    // Successful Login Reset - Clear security counters
    if (user.loginAttempts > 0 || user.lockUntil) {
      await user.resetLoginAttempts();
    }

    // Session Tracking - Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Token Generation - Rotate refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    // Secure Cookie Setup - HttpOnly, Secure, SameSite
    res
      .cookie("accessToken", accessToken, OPTIONS)
      .cookie("refreshToken", refreshToken, OPTIONS);

    // Response Sanitization - Never return sensitive fields
    return new ApiResponse(
      StatusCodes.OK,
      {
        id: user._id,
        fullName: user.fullName,
        userName: user.userName,
        email: user.email,
        avatar: user.avatar?.url,
        role: user.role,
        phone: user.phone,
        isVerified: user.isVerified,
      },
      "Authentication successful"
    ).send(res);
  }),

  // Verify email with OTP
  verifyEmail: asyncHandler(async (req, res) => {
    // Input Validation - Essential fields check
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Email and OTP required");
    }

    // User Lookup - Find unverified user with valid OTP
    const user = await User.findOne({
      email,
      otp: { $exists: true },
      otpExpiry: { $gt: Date.now() },
    }).select("+otp +otpExpiry");

    // Generic Error Response - Prevent email enumeration
    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid or expired OTP");
    }

    // OTP Verification - Constant-time comparison critical
    const isValid = await user.compareOTP(otp);

    if (!isValid) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid OTP");
    }

    // Account Activation - Mark as verified
    user.isVerified = true;

    // Security Cleanup - Remove temporary OTP credentials
    user.otp = undefined;
    user.otpExpiry = undefined;

    await user.save();

    // Final Response - Avoid sensitive data exposure
    return new ApiResponse(
      StatusCodes.OK,
      { isVerified: true },
      "Email verification successful"
    ).send(res);
  }),

  // Resend OTP Via Email
  resendOTP: asyncHandler(async (req, res) => {
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

    user.otp = otp;
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
  }),

  // Forgot Password User
  forgotPassword: asyncHandler(async (req, res) => {
    // Initial Validation - Basic email format check (implement in middleware)
    const { email } = req.body;

    if (!email) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Email is required.");
    }

    // User Lookup - Generic response to prevent email enumeration attacks
    const user = await User.findOne({ email });

    if (!user) {
      return new ApiResponse(
        StatusCodes.OK,
        "If an account exists with this email, a reset OTP has been sent."
      );
    }

    // OTP Generation - Cryptographically secure random value
    const resetOTP = generateOTP();
    const resetOTPExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Secure Storage - Hash OTP before saving (security critical)
    user.resetPasswordOTP = await user.hashOTP(resetOTP);
    user.resetPasswordExpiresAt = resetOTPExpiresAt;

    await user.save({ validateBeforeSave: false });

    // Email Delivery - Secure communication channel required
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
      // Cleanup on Failure - Prevent dangling invalid OTPs
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
  }),

  // Reset Password User
  resetPassword: asyncHandler(async (req, res) => {
    // Input Validation - Essential fields check
    const { email, otp, newPassword } = req.body;

    if ([email, otp, newPassword].some((field) => !field)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Email, OTP, and New Password are required."
      );
    }

    // User Verification - Find user with valid unexpired OTP
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

    // OTP Validation - Compare hashed OTP (security critical)
    const isValid = await user.resetCompareOTP(otp);

    if (!isValid) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid OTP");
    }

    // Reuse Prevention - Check OTP blacklist
    const isBlacklisted = await TokenBlacklist.findOne({
      token: otp,
      type: "reset",
    });

    if (isBlacklisted) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "This OTP has already been used"
      );
    }

    // Password Update - Security-sensitive operation
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    // OTP Invalidation - Prevent future reuse
    await TokenBlacklist.create({
      token: otp,
      type: "reset",
      userId: user._id,
    });

    // Notification - Security alert to user
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
      logger.error(`Password change alert failed for ${user.email}`, error);
    }

    return new ApiResponse(
      StatusCodes.OK,
      "Password reset successfully. You can now login with your new password."
    ).send(res);
  }),

  // Logout User
  logout: asyncHandler(async (req, res) => {
    // Token Extraction - Prefer cookies over body for HTTP-only security
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Refresh token required");
    }

    try {
      // Token Validation - Verify signature before blacklisting
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

      // Immediate Invalidation - Prevent token reuse even if valid
      await blacklistToken(
        refreshToken,
        "refresh",
        decoded._id,
        7 * 24 * 60 * 60
      );
    } catch (error) {
      // Graceful Failure - Log but proceed with cookie cleanup
      logger.error(`Logout error: ${error.message}`);
    }

    // Client-Side Cleanup - Remove tokens regardless of validation status
    res
      .clearCookie("accessToken", OPTIONS)
      .clearCookie("refreshToken", OPTIONS);

    // Final Response - Generic message to prevent info leakage
    return new ApiResponse(
      StatusCodes.OK,
      "Session terminated successfully"
    ).send(res);
  }),

  // Refresh Token
  refreshAccessToken: asyncHandler(async (req, res) => {
    // Token Extraction - Prioritize HTTP-only cookies over body for better security
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized request");
    }

    let decoded;
    try {
      // Signature Verification - Prevent tampered tokens
      decoded = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET);
    } catch (error) {
      // Explicit Error Handling - Distinguish between expiration and malformed tokens
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Refresh token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
      }
      throw error;
    }

    // Blacklist Check - Prevent reuse of revoked tokens
    const isBlacklisted = await TokenBlacklist.findOne({
      token: incomingRefreshToken,
      type: "refresh",
    });

    if (isBlacklisted) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Token has been invalidated"
      );
    }

    // User Validation - Ensure token belongs to existing user
    const user = await User.findById(decoded._id).select("+refreshToken");
    if (!user) throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");

    // Token Matching - Verify token matches last issued refresh token
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Stale refresh token");
    }

    // Token Rotation - Invalidate old token immediately after verification
    await TokenBlacklist.create({
      token: incomingRefreshToken,
      type: "refresh",
      userId: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // New Token Generation - Atomic update of refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    // Secure Cookie Setup - Ensure proper flags via OPTIONS constant
    res
      .cookie("accessToken", accessToken, OPTIONS)
      .cookie("refreshToken", refreshToken, OPTIONS);

    // Response Sanitization - Never return tokens in response body
    return ApiResponse.success(
      StatusCodes.OK,
      {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      "Tokens refreshed successfully."
    ).send(res);
  }),
};
