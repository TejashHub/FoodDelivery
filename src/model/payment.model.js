const { default: mongoose } = require("mongoose");

const paymentSchema = mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    shortId: {
      type: String,
      unique: true,
      uppercase: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR"],
    },
    taxAmount: Number,
    convenienceFee: {
      type: Number,
      default: 0,
    },
    tipAmount: {
      type: Number,
      default: 0,
    },
    method: {
      type: String,
      enum: [
        "COD",
        "Credit Card",
        "Debit Card",
        "UPI",
        "Net Banking",
        "Wallet",
        "Gift Card",
        "Pay Later",
      ],
      required: true,
    },
    methodDetails: {
      card: {
        last4: String,
        brand: String,
        issuer: String,
        isInternational: Boolean,
      },
      upi: {
        vpa: String,
        app: String,
      },
      netBanking: {
        bank: String,
        bankCode: String,
      },
      wallet: {
        provider: String,
        walletId: String,
      },
      payLater: {
        provider: String,
        dueDate: Date,
      },
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
        "partially_refunded",
        "disputed",
        "on_hold",
      ],
      default: "initiated",
      required: true,
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        reason: String,
        changedBy: String,
      },
    ],
    transactionId: String,
    gateway: {
      name: String,
      reference: String,
      mode: String,
    },
    gatewayResponse: Schema.Types.Mixed,
    gatewayFees: Number,
    refunds: [
      {
        refundId: String,
        amount: Number,
        reason: String,
        initiatedBy: { type: Schema.Types.ObjectId, ref: "User" },
        processedAt: Date,
        status: {
          type: String,
          enum: ["requested", "processing", "completed", "failed"],
        },
        method: String,
      },
    ],
    riskScore: Number,
    fraudFlags: [String],
    verification: {
      otpVerified: Boolean,
      twoFactorVerified: Boolean,
      authenticationMethod: String,
    },
    ipAddress: String,
    deviceInfo: {
      id: String,
      type: String,
      os: String,
    },
    userAgent: String,
    isTestPayment: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ "methodDetails.card.last4": 1 });
paymentSchema.index({ "methodDetails.upi.vpa": 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

paymentSchema.pre("save", function (next) {
  if (!this.shortId) {
    this.shortId = "PAY" + Math.floor(100000 + Math.random() * 900000);
  }

  if (this.isModified("status")) {
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({
      status: this.status,
      changedBy: "system",
    });
  }
  next();
});

paymentSchema.virtual("isSuccessful").get(function () {
  return this.status === "completed";
});

paymentSchema.virtual("isRefundable").get(function () {
  return ["completed", "partially_refunded"].includes(this.status);
});

paymentSchema.methods.initiateRefund = function (amount, reason, initiatedBy) {
  if (!this.isRefundable) {
    throw new Error("Payment is not refundable in its current state");
  }

  if (amount > this.amount - this.getRefundedAmount()) {
    throw new Error("Refund amount exceeds available balance");
  }

  this.refunds = this.refunds || [];
  this.refunds.push({
    refundId: "RFND" + Math.floor(100000 + Math.random() * 900000),
    amount,
    reason,
    initiatedBy,
    status: "requested",
    method: "original",
  });

  if (amount === this.amount - this.getRefundedAmount()) {
    this.status = "refunded";
  } else {
    this.status = "partially_refunded";
  }
};

paymentSchema.methods.getRefundedAmount = function () {
  return this.refunds
    .filter((r) => r.status === "completed")
    .reduce((sum, refund) => sum + refund.amount, 0);
};

module.exports = mongoose.model("Payment", paymentSchema);
