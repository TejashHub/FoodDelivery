import mongoose from "mongoose";

const dishSchema = new mongoose(
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

const Dish = mongoose.model("Dish", dishSchema);

export default Dish;
