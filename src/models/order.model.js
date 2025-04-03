import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
    },
    shortId: {
      type: String,
      unique: true,
      uppercase: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: String,
    userPhone: String,
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    restaurantName: String,
    restaurantPhone: String,
    restaurantLocation: {
      type: { type: String, default: "Point" },
      coordinates: [Number],
    },
    items: [
      {
        menuItem: {
          type: Schema.Types.ObjectId,
          ref: "MenuItem",
        },
        name: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        basePrice: {
          type: Number,
          required: true,
        },
        discountedPrice: Number,
        specialInstructions: String,
        customizations: [
          {
            groupName: String,
            optionName: String,
            choice: String,
            price: Number,
          },
        ],
        addons: [
          {
            groupName: String,
            name: String,
            price: Number,
          },
        ],
        itemTotal: { type: Number, required: true },
      },
    ],
    deliveryAddress: {
      type: {
        type: String,
        enum: ["home", "work", "other"],
        required: true,
      },
      addressLine1: { type: String, required: true },
      addressLine2: String,
      landmark: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: {
        type: String,
        required: true,
        validate: {
          validator: function (v) {
            return /^\d{6}$/.test(v);
          },
        },
      },
      geoLocation: {
        type: { type: String, default: "Point" },
        coordinates: [Number],
      },
      contactPhone: String,
    },
    payment: {
      method: {
        type: String,
        enum: [
          "COD",
          "Credit Card",
          "Debit Card",
          "UPI",
          "Net Banking",
          "Wallet",
        ],
        required: true,
      },
      transactionId: String,
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },
      gateway: String,
      amount: { type: Number, required: true },
      taxAmount: Number,
      walletUsed: Number,
      couponUsed: {
        code: String,
        discount: Number,
      },
      status: {
        current: {
          type: String,
          enum: [
            "placed",
            "confirmed",
            "preparing",
            "ready",
            "picked up",
            "on the way",
            "arrived",
            "delivered",
            "cancelled",
            "rejected",
          ],
          default: "placed",
        },
        history: [
          {
            status: String,
            timestamp: { type: Date, default: Date.now },
            notes: String,
          },
        ],
      },
      deliveryAgent: {
        agent: {
          type: Schema.Types.ObjectId,
          ref: "DeliveryAgent",
        },
        name: String,
        phone: String,
        vehicle: {
          type: String,
          number: String,
        },
        locationUpdates: [
          {
            timestamp: { type: Date, default: Date.now },
            coordinates: [Number],
            accuracy: Number,
          },
        ],
      },
      pricing: {
        itemsTotal: { type: Number, required: true },
        deliveryFee: { type: Number, required: true },
        packagingFee: { type: Number, default: 0 },
        taxes: {
          gst: Number,
          serviceTax: Number,
        },
        tip: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        grandTotal: { type: Number, required: true },
      },
      timing: {
        placedAt: { type: Date, default: Date.now },
        confirmedAt: Date,
        preparationStartedAt: Date,
        readyAt: Date,
        pickedUpAt: Date,
        deliveredAt: Date,
        estimatedDelivery: Date,
        preparationTime: Number,
        deliveryTime: Number,
        totalTime: Number,
      },
      issues: [
        {
          type: {
            type: String,
            enum: [
              "missing_item",
              "wrong_item",
              "quality_issue",
              "delivery_issue",
            ],
          },
          description: String,
          status: {
            type: String,
            enum: ["open", "in_progress", "resolved", "refunded"],
            default: "open",
          },
          resolution: String,
          timestamp: { type: Date, default: Date.now },
        },
      ],
      source: {
        type: String,
        enum: ["app", "web", "partner", "call_center"],
        default: "app",
      },
      deviceInfo: {
        platform: String,
        os: String,
        appVersion: String,
      },
      isTestOrder: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

orderSchema.index({ "deliveryAddress.geoLocation": "2dsphere" });
orderSchema.index({ restaurantLocation: "2dsphere" });
orderSchema.index({ "deliveryAgent.locationUpdates.coordinates": "2dsphere" });

orderSchema.pre("save", function (next) {
  if (!this.shortId) {
    this.shortId = "SWGY" + Math.floor(1000 + Math.random() * 9000);
  }

  if (this.status.current === "delivered" && this.timing.deliveredAt) {
    this.timing.totalTime = Math.round(
      (this.timing.deliveredAt - this.timing.placedAt) / (1000 * 60)
    );
  }

  next();
});

orderSchema.methods.updateStatus = function (newStatus, notes = "") {
  this.status.current = newStatus;
  this.status.history.push({
    status: newStatus,
    notes,
  });
  switch (newStatus) {
    case "confirmed":
      this.timing.confirmedAt = new Date();
      break;
    case "preparing":
      this.timing.preparationStartedAt = new Date();
      break;
    case "ready":
      this.timing.readyAt = new Date();
      this.timing.preparationTime = Math.round(
        (this.timing.readyAt - this.timing.preparationStartedAt) / (1000 * 60)
      );
      break;
    case "delivered":
      this.timing.deliveredAt = new Date();
      this.timing.deliveryTime = Math.round(
        (this.timing.deliveredAt - this.timing.pickedUpAt) / (1000 * 60)
      );
      break;
  }
};

orderSchema.virtual("isDelivered").get(function () {
  return this.status.current === "delivered";
});

orderSchema.virtual("isCancelled").get(function () {
  return this.status.current === "cancelled";
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
