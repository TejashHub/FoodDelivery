/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import uniqueValidator from "mongoose-unique-validator";

import {
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN,
  ACCOUNT_LOCK_DURATION,
  MAX_LOGIN_ATTEMPTS,
} from "../constants/constant.js";

// User Schema
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, required: true },
    userName: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: true,
    },
    password: { type: String, select: false, required: true },
    phone: { type: String, trim: true },
    addresses: [
      {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        postalCode: { type: String, trim: true },
        country: { type: String, trim: true },
        latitude: Number,
        longitude: Number,
        isDefault: { type: Boolean, default: false },
      },
    ],
    avatar: {
      public_id: { type: String, default: null },
      url: { type: String, default: null },
    },
    role: {
      type: String,
      enum: ["user", "admin", "superAdmin"],
      default: "user",
    },

    isVerified: { type: Boolean, default: false },
    refreshToken: { type: String, select: false },
    resetPasswordOTP: { type: String, select: false },
    resetPasswordExpiresAt: { type: Date, select: false },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    isActive: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    tokenVersion: { type: Number, default: 0 },
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

// Pre-save Hook
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  if (this.isModified("otp")) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.otp = await bcrypt.hash(this.otp, salt);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Virtual Property for Full Address
userSchema.virtual("addresses.fullAddress").get(function () {
  if (!this.addresses || this.addresses.length === 0) return null;
  return this.addresses
    .map(
      (address) =>
        `${address.street}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`
    )
    .join(" | ");
});

// User Methods
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
    if (!this.otp) {
      throw new Error("OTP not found in user document");
    }

    if (!this.otpExpiry || this.otpExpiry < Date.now()) {
      console.log("OTP expired.");
      return false;
    }

    const isMatch = await bcrypt.compare(candidateOTP, this.otp);
    return isMatch;
  },

  resetCompareOTP: async function (candidateOTP) {
    if (!this.resetPasswordOTP) null;
    if (
      !this.resetPasswordExpiresAt ||
      this.resetPasswordExpiresAt < Date.now()
    )
      return false;
    return await bcrypt.compare(candidateOTP, this.resetPasswordOTP);
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
      { _id: this._id, tokenVersion: this.tokenVersion },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  },

  isLocked: function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
  },

  incrementLoginAttempts: async function () {
    if (this.lockUntil && this.lockUntil < Date.now()) {
      this.loginAttempts = 1;
      this.lockUntil = undefined;
      return await this.save();
    }

    this.loginAttempts += 1;
    if (this.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.lockUntil = Date.now() + ACCOUNT_LOCK_DURATION;
    }
    return await this.save();
  },

  resetLoginAttempts: async function () {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    return await this.save();
  },

  incrementTokenVersion: async function () {
    this.tokenVersion += 1;
    return await this.save();
  },
};

// Unique Validator Plugin
userSchema.plugin(uniqueValidator, {
  message: "{PATH} '{VALUE}' is already in use",
});

// Export User Model
const User = mongoose.model("User", userSchema);
export default User;
