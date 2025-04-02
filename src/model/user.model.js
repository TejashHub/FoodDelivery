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
  ACCOUNT_LOCK_DURATION,
  MAX_LOGIN_ATTEMPTS,
} from "../constant/constant.js";
import uniqueValidator from "mongoose-unique-validator";

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["access", "refresh", "reset"],
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
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
      match: [
        /^[a-zA-Z\s'-]+$/,
        "Full name can only contain letters, spaces, apostrophes, and hyphens",
      ],
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
        /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
        "Username can only contain letters, numbers and underscores",
      ],
      validate: {
        validator: function (v) {
          const reserved = ["admin", "root", "system", "support"];
          return !reserved.includes(v.toLowerCase());
        },
        message: "Username '{VALUE}' is reserved",
      },
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: [true, "Email is required"],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
      match: [
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must contain at least one uppercase, lowercase, number, and special character",
      ],
    },
    phone: {
      type: String,
      trim: true,
      match: [
        /^\+?[1-9]\d{1,14}$/,
        "Phone number must be in international format (e.g., +1234567890)",
      ],
    },
    addresses: [
      {
        street: {
          type: String,
          required: [true, "Street address is required"],
          trim: true,
        },
        city: {
          type: String,
          required: [true, "City is required"],
          trim: true,
        },
        state: {
          type: String,
          required: [true, "State is required"],
          trim: true,
        },
        postalCode: {
          type: String,
          required: [true, "Postal code is required"],
          trim: true,
          match: [/^[0-9a-zA-Z\- ]+$/, "Invalid postal code"],
        },
        country: {
          type: String,
          required: [true, "Country is required"],
          trim: true,
        },
        latitude: Number,
        longitude: Number,
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
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
      enum: ["user", "admin", "moderator"],
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
    resetPasswordOTP: {
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
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.resetPasswordOTP;
        delete ret.otp;
        delete ret.twoFactorSecret;
        delete ret.tokenVersion;
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre("save", function (next) {
  if (this.isModified("userName")) {
    this.userName = this.userName.toLowerCase();
  }
  next();
});

userSchema.virtual("addresses.fullAddress").get(function () {
  return this.addresses.map(
    (address) =>
      `${address.street}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`
  );
});

userSchema.methods = {
  isAdmin: function () {
    return this.role === "admin";
  },

  comparePassword: async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  },

  hashOTP: async function (otp) {
    return await bcrypt.hash(otp, 10);
  },

  compareOTP: async function (candidateOTP) {
    if (!this.otp) throw new Error("OTP not found in user document");
    if (!this.otpExpiry || this.otpExpiry < Date.now()) return false;
    return await bcrypt.compare(candidateOTP, this.otp);
  },

  generateAccessToken: function () {
    return jwt.sign(
      {
        _id: this._id,
        email: this.email,
        fullName: this.fullName,
        userName: this.userName,
        role: this.role,
      },
      ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
  },

  generateRefreshToken: function () {
    return jwt.sign(
      {
        _id: this._id,
        tokenVersion: this.tokenVersion,
      },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  },

  isLocked: function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
  },

  incrementLoginAttempts: async function () {
    if (this.lockUntil && this.lockUntil < Date.now()) {
      return await this.updateOne({
        $set: { loginAttempts: 1 },
        $unset: { lockUntil: 1 },
      });
    }

    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
      updates.$set = { lockUntil: Date.now() + ACCOUNT_LOCK_DURATION };
    }
    return await this.updateOne(updates);
  },

  resetLoginAttempts: async function () {
    return await this.updateOne({
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 },
    });
  },

  incrementTokenVersion: async function () {
    return await this.updateOne({ $inc: { tokenVersion: 1 } });
  },
};

userSchema.plugin(uniqueValidator, {
  message: "{PATH} '{VALUE}' is already in use",
});

const User = mongoose.model("User", userSchema);

export default User;
