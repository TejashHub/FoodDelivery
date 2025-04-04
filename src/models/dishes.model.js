/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import mongoose from "mongoose";

const dishesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
    },
    category: { type: String, enum: ["Appetizer", "Main Course", "Dessert"] },
    imageUrl: String,
    isAvailable: { type: Boolean, default: true },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
  },
  { timestamps: true }
);

const Dishes = mongoose.model("Dish", dishesSchema);

export default Dishes;
