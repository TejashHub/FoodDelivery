/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN,
} from "../constant/constant.js";

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["refresh", "reset"],
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: "24h",
  },
});

export const TokenBlacklist = mongoose.model(
  "TokenBlacklist",
  tokenBlacklistSchema
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      required: [true, "Full name is required"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    userName: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: [true, "Username is required"],
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [20, "Username cannot exceed 20 characters"],
      match: [
        /^[a-z0-9_]+$/,
        "Username can only contain lowercase letters, numbers and underscores",
      ],
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: [true, "Email is required"],
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    avatar: {
      public_id: {
        type: String,
        default: null,
      },
      url: {
        type: String,
        default: null,
      },
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpiresAt: {
      type: Date,
      select: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.resetPasswordToken;
        delete ret.otp;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    next(error);
  }
});

userSchema.methods = {
  // Compare passwords
  comparePassword: async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  },

  // Hash OTP
  hashOTP: async function (otp) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(otp, salt);
  },

  // Compare OTP
  compareOTP: async function (candidateOTP) {
    return await bcrypt.compare(candidateOTP, this.resetPasswordToken);
  },

  // Generate Access Token
  generateAccessToken: function () {
    return jwt.sign(
      {
        _id: this._id,
        email: this.email,
        fullName: this.fullName,
        userName: this.userName,
      },
      ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
  },

  // Generate Refresh Token
  generateRefreshToken: function () {
    return jwt.sign({ _id: this._id }, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
  },

  // Account lock check
  isLocked: function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
  },
  // Increment login attempts
  incrementLoginAttempts: async function () {
    if (this.lockUntil && this.lockUntil < Date.now()) {
      return await this.updateOne({
        $set: { loginAttempts: 1 },
        $unset: { lockUntil: 1 },
      });
    }

    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= 5) {
      updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 };
    }
    return await this.updateOne(updates);
  },
};

const User = mongoose.model("User", userSchema);

export default User;
