import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [255, "Message cannot exceed 255 characters"],
    },
    type: {
      type: String,
      enum: {
        values: [
          "order_status",
          "promotion",
          "system",
          "payment",
          "delivery_update",
        ],
        message: "Invalid notification type",
      },
      required: [true, "Notification type is required"],
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    deepLink: {
      type: String,
      trim: true,
      maxlength: [500, "Deep link cannot exceed 500 characters"],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    expiryDate: {
      type: Date,
      validate: {
        validator: function (value) {
          return value > Date.now();
        },
      },
      message: "Expiry date must be in the future",
    },
  },
  {
    timestamps: true,
    indexes: [{ createdAt: -1 }, { user: 1, isRead: 1 }],
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
