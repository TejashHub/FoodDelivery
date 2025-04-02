/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import User from "../../model/user.model.js";
import jwt from "jsonwebtoken";
import generateOTP from "../../utils/otpGenerator.js";
import sendEmail from "../../utils/nodemailer.js";
import { TokenBlacklist } from "../../model/user.model.js";
import { ApiError } from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../middleware/asyncHandler.middleware.js";
import { REFRESH_TOKEN_SECRET } from "../../constant/constant.js";
import {
  cloudinaryFileUpload,
  cloudinaryFileRemove,
} from "../../utils/cloudinary.js";
import rateLimit from "express-rate-limit";

// Cookies Options
const cookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Authentication limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many requests from this IP, please try again later",
  skipSuccessfulRequests: true,
});

// Password Reset Limit
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: "Too many password reset attempts, please try again later",
});

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
  const { fullName, email, userName, password } = req.body;

  if ([fullName, email, userName, password].some((field) => !field?.trim())) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "All fields are required");
  }

  const existedUser = await User.findOne({ $or: [{ userName }, { email }] });

  if (existedUser) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      "Username or Email already in use."
    );
  }

  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar file is required");
  }

  const avatar = await cloudinaryFileUpload(avatarLocalPath);

  if (!avatar) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar file upload failed");
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  const user = await User.create({
    fullName,
    email,
    userName,
    password,
    avatar: {
      public_id: avatar.public_id,
      url: avatar.secure_url,
    },
    otp: await bcrypt.hash(otp, 10),
    otpExpiry,
  });

  try {
    await sendEmail({
      email: user.email,
      subject: "Verify Your Email",
      template: "emailVerification",
      data: {
        name: user.fullName,
        otp,
        expiresIn: "10 minutes",
      },
    });
  } catch (error) {
    await cloudinaryFileRemove(avatar.public_id);
    await User.findByIdAndDelete(user._id);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to send verification email"
    );
  }

  return res.status(StatusCodes.CREATED).json({
    success: true,
    message:
      "Registration successful. Please check your email to verify your account.",
    data: {
      id: user._id,
      fullName: user.fullName,
      userName: user.userName,
      email: user.email,
      avatar: user.avatar?.url,
    },
  });
});

// Login User
export const login = asyncHandler(async (req, res) => {
  const { email, userName, password } = req.body;

  if (!password || (!userName && !email)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Username or email and password are required"
    );
  }

  const user = await User.findOne({ $or: [{ email }, { userName }] }).select(
    "+password +refreshToken +loginAttempts +lockUntil"
  );

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

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
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

  return res
    .status(StatusCodes.OK)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json({
      success: true,
      message: "User logged in successfully",
      data: {
        id: user._id,
        fullName: user.fullName,
        userName: user.userName,
        email: user.email,
        avatar: user.avatar?.url,
        role: user.role,
        isVerified: user.isVerified,
        accessToken,
        refreshToken,
      },
    });
});

// Forgot Password User
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email is required.");
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message:
        "If an account exists with this email, a reset OTP has been sent",
    });
  }

  const resetOTP = generateOTP();
  const resetOTPExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.resetPasswordOTP = await user.hashOTP(resetOTP);
  user.resetPasswordExpiresAt = resetOTPExpiresAt;
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset OTP",
      template: "passwordReset",
      data: {
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

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "If an account exists with this email, a reset OTP has been sent",
  });
});

// Reset Password User
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Email, OTP, and New Password are required."
    );
  }

  if (newPassword.length < 8) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Password must be at least 8 characters"
    );
  }

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  if (!passwordRegex.test(newPassword)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Password must contain: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char"
    );
  }

  const user = await User.findOne({
    email,
    resetPasswordOTP: { $exists: true },
    resetPasswordExpiresAt: { $gt: Date.now() },
  }).select("+resetPasswordOTP");

  if (!user) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Invalid or expired OTP. Please request a new one."
    );
  }

  const isOTPValid = await user.compareOTP(otp);
  if (!isOTPValid) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid OTP");
  }

  const isBlacklisted = await TokenBlacklist.findOne({
    token: otp,
    type: "reset",
  });
  if (isBlacklisted) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This OTP has already been used"
    );
  }

  user.password = newPassword;
  user.resetPasswordOTP = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();

  await TokenBlacklist.create({ token: otp, type: "reset", userId: user._id });

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Changed Successfully",
      template: "passwordChanged",
      data: {
        name: user.fullName,
        timestamp: new Date().toLocaleString(),
      },
    });
  } catch (error) {
    console.error("Password change confirmation email failed:", error);
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message:
      "Password reset successfully. You can now login with your new password.",
  });
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

    if (isBlacklisted) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Token has been invalidated"
      );
    }

    const user = await User.findById(decoded._id).select("+refreshToken");

    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Refresh token is expired or already used"
      );
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    await TokenBlacklist.create({
      token: incomingRefreshToken,
      type: "refresh",
      userId: user._id,
    });

    return res
      .status(StatusCodes.OK)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json({
        success: true,
        message: "Tokens refreshed successfully",
        data: {
          accessToken,
          refreshToken,
        },
      });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Refresh token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
    }
    throw error;
  }
});

// Logout User
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Refresh token is required.");
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    await TokenBlacklist.create({
      token: refreshToken,
      type: "refresh",
      userId: decoded._id,
    });
    await User.findByIdAndUpdate(decoded._id, {
      $unset: { refreshToken: 1 },
      $inc: { tokenVersion: 1 },
    });
  } catch (error) {
    console.error("Error during logout:", error);
  }

  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Verify email with OTP
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email and OTP are required");
  }

  const user = await User.findOne({
    email,
    otp: { $exists: true },
    otpExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid or expired OTP");
  }

  const isOTPValid = await user.compareOTP(otp);
  if (!isOTPValid) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid OTP");
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Email verified successfully. You can now login.",
  });
});

// Resend verification email
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email is required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(StatusCodes.OK).json({
      success: true,
      message:
        "If an account exists with this email, a verification OTP has been sent",
    });
  }

  if (user.isVerified) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email is already verified");
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  user.otp = await bcrypt.hash(otp, 10);
  user.otpExpiry = otpExpiry;
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      subject: "Verify Your Email",
      template: "emailVerification",
      data: {
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
  return res.status(StatusCodes.OK).json({
    success: true,
    message:
      "If an account exists with this email, a verification OTP has been sent",
  });
});
export { authLimiter, passwordResetLimiter };
