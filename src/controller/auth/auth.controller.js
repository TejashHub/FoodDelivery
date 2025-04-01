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
import { asyncHandler } from "../../middleware/index.js";
import { StatusCodes } from "http-status-codes";
import { REFRESH_TOKEN_SECRET } from "../../constant/constant.js";
import {
  cloudinaryFileUpload,
  cloudinaryFileRemove,
} from "../../utils/cloudinary.js";

// Cookies Options
const options = {
  httpOnly: true,
  secure: false,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Authentication limit
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many requests from this IP, please try again later",
  skipSuccessfulRequests: true,
});

// Password Reset Limit
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many password reset attempts, please try again later",
});

// Generate Tokens
const generateAccessAndRefreshToken = async (id) => {
  if (!id) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "User not found");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const access_token = await user.generateAccessToken();
  const refresh_token = await user.generateRefreshToken();

  user.access_token = access_token;
  user.refreshToken = refresh_token;
  await user.save({ validateBeforeSave: false });

  return { access_token, refresh_token };
};

// Register User
export const register = asyncHandler(async (req, res) => {
  const { fullName, email, userName, password } = req.body;

  if ([fullName, email, userName, password].some((field) => !field?.trim())) {
    throw ApiError(StatusCodes.BAD_REQUEST, "All fields are required");
  }

  const existedUser = await User.findOne({ $or: [{ userName }, { email }] });

  if (existedUser)
    throw ApiError(StatusCodes.CONFLICT, "Username or Email already in use.");

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
    avatar: avatar
      ? {
          public_id: avatar.public_id,
          url: avatar.secure_url,
        }
      : undefined,
    otp,
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
    if (avatar?.public_id) {
      await cloudinaryFileRemove(avatar.public_id);
    }
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

  const isPassword = await user.comparePassword(password);

  if (!isPassword) {
    await user.incrementLoginAttempts();
    const attemptsLeft = 5 - (user.loginAttempts + 1);
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      `Invalid credentials. ${
        attemptsLeft > 0
          ? `${attemptsLeft} attempts left`
          : "Account locked for 30 minutes"
      }`
    );
  }

  if (user.loginAttempts > 0 || user.lockUntil) {
    await User.findByIdAndUpdate(user._id, {
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 },
    });
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const { access_token, refresh_token } = await generateTokens(user._id);

  await user.save({ validateBeforeSave: false });

  return res
    .status(StatusCodes.OK)
    .cookie("accessToken", access_token, options)
    .cookie("refreshToken", refresh_token, options)
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
        access_token,
        refresh_token,
      },
    });
});

// Forgot Passowrd User
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

  const resetToken = generateOTP();
  const hashedResetToken = await user.hashOTP(resetToken);
  const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.resetPasswordToken = hashedResetToken;
  user.resetPasswordExpiresAt = resetTokenExpiresAt;
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset OTP",
      template: "passwordReset",
      data: {
        name: user.fullName,
        otp: resetToken,
        expiresIn: "10 minutes",
      },
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
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

  if (!email || !otp || !newPassword)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Email, OTP, and New Password are required."
    );

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
    resetPasswordToken: { $exists: true },
    resetPasswordExpiresAt: { $gt: Date.now() },
  }).select("+resetPasswordToken");

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
  user.resetPasswordToken = undefined;
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

// Reset Token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body.refresh_token;

  if (!refreshToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized request");
  }

  try {
    const decoaded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

    const isBlacklisted = await TokenBlacklist.findOne({
      token: refreshToken,
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

    if (refreshToken !== user?.refreshToken) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Refresh token is expired or already used"
      );
    }

    const { access_token, refresh_token } = await generateAccessAndRefreshToken(
      user._id
    );

    await TokenBlacklist.create({
      token: refreshToken,
      type: "refresh",
      userId: user._id,
    });

    return res
      .status(StatusCodes.OK)
      .cookie("accessToken", access_token, options)
      .cookie("refreshToken", refresh_token, options)
      .json({
        success: true,
        message: "Tokens refreshed successfully",
        data: {
          access_token,
          refresh_token,
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

// Logout Password User
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;

  res.clearCookie("access_token", options);
  res.clearCookie("refresh_token", options);

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
    });
  } catch (error) {
    console.error("Error blacklisting refresh token:", error);
  }
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

  const isOTPValid = await bcrypt.compare(otp, user.otp);
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

// Get User Profile
export const getProfile = () =>
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          userName: user.userName,
          email: user.email,
          avatar: user.avatar?.url,
          role: user.role,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
      },
    });
  });

// Update User Profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, userName } = req.body;

  avatar = await cloudinaryFileUpload(req.file.path, "avatars");

  if (!avatar) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Avatar upload failed");
  }

  const updateData = { fullName, userName };

  if (avatar) {
    if (req.user.avatar?.public_id) {
      await cloudinaryFileRemove(req.user.avatar.public_id);
    }
    updateData.avatar = {
      public_id: avatar.public_id,
      url: avatar.secure_url,
    };
  }

  const user = await User.findByIdAndUpdate(req.user._id, updateData, {
    new: true,
    runValidators: true,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        userName: user.userName,
        email: user.email,
        avatar: user.avatar?.url,
      },
    },
  });
});

// Change Password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Current and new password are required"
    );
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "New password must be different from current password"
    );
  }

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Password must contain at least 8 characters, including uppercase, lowercase, number and special character"
    );
  }

  const user = await User.findById(req.user._id).select("+password");

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      "Current password is incorrect"
    );
  }

  user.password = newPassword;
  await user.save();

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Changed",
      template: "passwordChanged",
      data: {
        name: user.fullName,
        timestamp: new Date().toLocaleString(),
      },
    });
  } catch (error) {
    console.error("Password change notification failed:", error);
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Password changed successfully",
  });
});

// Delete Account
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Password is required");
  }

  const user = await User.findById(req.user._id).select("+password");
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Password is incorrect");
  }

  if (user.avatar?.public_id) {
    await cloudinaryFileRemove(user.avatar.public_id);
  }

  await User.findByIdAndDelete(req.user._id);

  res.clearCookie("access_token", cookieOptions);
  res.clearCookie("refresh_token", cookieOptions);

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Account deleted successfully",
  });
});
