import mongoose, { Schema } from "mongoose";

const deliveryZoneSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  deliveryFree: {
    type: Number,
    default: 0,
    min: 0,
  },
  minOrderAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  estimatedDeliveryTime: {
    type: String,
    default: "30-45 mins",
  },
  coordinates: [
    {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  ],
  restaurants: [
    {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const DeliveryZone = mongoose.model("DeliveryZone", deliveryZoneSchema);

export default DeliveryZone;
