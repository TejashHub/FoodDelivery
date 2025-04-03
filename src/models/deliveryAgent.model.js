/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import mongoose from "mongoose";

const deliveryAgentSchema = mongoose.Schema(
  {
    agentId: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, unique: true },
    vehicleDetails: {
      type: { type: String, enum: ["bike", "cycle", "scooter"] },
      number: String,
    },
    currentLocation: {
      lat: Number,
      lng: Number,
    },
    isAvailable: { type: Boolean, default: true },
    currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    rating: { type: Number, default: 0 },
    completedDeliveries: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const deliveryAgent = mongoose.model("deliveryAgent", deliveryAgentSchema);

export default deliveryAgent;
