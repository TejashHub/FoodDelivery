/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [6, "Coupon code must be at least 6 characters"],
      maxlength: [20, "Coupon code cannot exceed 20 characters"],
    },
    discountType: {
      type: String,
      enum: {
        values: ["percentage", "fixed"],
        message: "Discount type must be either percentage or fixed",
      },
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: [1, "Discount value must be at least 1"],
      max: [100, "Percentage discount cannot exceed 100%"],
    },
    validFrom: {
      type: Date,
      default: Date.now,
      validate: {
        validator: function (value) {
          return !this.validUntil || value < this.validUntil;
        },
        message: "Valid from date must be before valid until date",
      },
    },
    validUntil: {
      type: Date,
      validate: {
        validator: function (value) {
          return value > this.validFrom;
        },
      },
      message: "Valid until date must be after valid from date",
    },
    maxUses: {
      type: Number,
      min: [1, "Max uses must be at least 1"],
      default: null,
    },
    minOrderValue: {
      type: Number,
      min: [0, "Minimum order value cannot be negative"],
      default: 0,
    },
    usedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    applicableRestaurants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
