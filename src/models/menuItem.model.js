/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, unique: true, required: true },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuCategory",
      required: true,
    },
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    discountPrice: Number,
    isVeg: { type: Boolean, default: true },
    ingredients: [String],
    dietaryTags: [
      {
        type: String,
        enum: ["Gluten-Free", "Vegan", "Jain", "Eggless", "Contains Nuts"],
      },
    ],
    customizationOptions: [
      {
        name: String,
        isMultiSelect: Boolean,
        isRequired: Boolean,
        options: [
          {
            name: String,
            price: Number,
            isDefault: Boolean,
          },
        ],
      },
    ],
    addonGroups: [
      {
        name: String,
        minSelection: Number,
        maxSelection: Number,
        items: [
          {
            name: String,
            price: Number,
          },
        ],
      },
    ],
    images: [String],
    isAvailable: { type: Boolean, default: true },
    isBestSeller: { type: Boolean, default: false },
    rating: {
      value: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    orderCount: { type: Number, default: 0 },
    preparationTime: Number,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

menuItemSchema.index({ price: 1 });
menuItemSchema.index({ isVeg: 1 });
menuItemSchema.index({ dietaryTags: 1 });
menuItemSchema.index({ createdAt: -1 });
menuItemSchema.index({ orderCount: -1 });
menuItemSchema.index({
  name: "text",
  description: "text",
  ingredients: "text",
});
menuItemSchema.index({ restaurantId: 1, categoryId: 1 });

const MenuItem = mongoose.model("MenuItem", menuItemSchema);

export default MenuItem;
