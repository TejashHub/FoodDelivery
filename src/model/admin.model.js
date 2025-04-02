import mongoose from "mongoose";
import User from "./user.model.js";

const adminSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true,
      validate: {
        validator: async function (userId) {
          const user = await User.findById(userId)
            .select("role isActive")
            .lean();
          return user?.isActive && user.role === "user";
        },
        message: "User must be active regular user",
      },
    },
    adminId: {
      type: String,
      unique: true,
      immutable: true,
      validate: {
        validator: (v) => /^ADM-[2-9]\d{2}[1-9]$/.test(v),
        message:
          "Admin ID must be in format ADM-XXX where X is 2-9 with no trailing zero",
      },
      default: function () {
        const randomNum = Math.floor(2000 + Math.random() * 8000);
        return `ADM-${randomNum}`.replace(/0+$/, "");
      },
    },
    permissions: {
      manageUsers: { type: Boolean, default: false },
      manageRestaurants: { type: Boolean, default: false },
      manageCoupons: { type: Boolean, default: false },
      viewAnalytics: { type: Boolean, default: true },
      moderateContent: { type: Boolean, default: true },
      manageSettings: { type: Boolean, default: false },
    },
    accessLevel: {
      type: String,
      enum: ["super", "regional", "support"],
      default: "support",
      required: [true, "Access level is required"],
      validate: {
        validator: function (v) {
          if (v === "super") {
            return this.$locals?.isSuperAdminCreation || false;
          }
          return true;
        },
        message: "Super admin can only be created via special method",
      },
    },
    assignedRegions: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          if (this.accessLevel === "regional") {
            return (
              v.length > 0 && v.every((region) => typeof region === "string")
            );
          }
          return true;
        },
        message: "Regional admins require at least one valid region",
      },
    },
    lastAccess: Date,
    activityLog: {
      type: [
        {
          action: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
          },
          timestamp: {
            type: Date,
            default: Date.now,
          },
          ipAddress: {
            type: String,
            required: true,
            validate: {
              validator: (ip) =>
                /^(?:\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(
                  ip
                ),
              message: "Invalid IP address format",
            },
          },
          metadata: mongoose.Schema.Types.Mixed,
        },
      ],
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        delete ret.id;
        delete ret.activityLog;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
adminSchema.index({ accessLevel: 1, isActive: 1 });
adminSchema.index({ assignedRegions: 1 });
adminSchema.index({ lastAccess: -1 });

// Virtuals
adminSchema.virtual("permissionTier").get(function () {
  const tiers = { super: 3, regional: 2, support: 1 };
  return tiers[this.accessLevel] || 0;
});

// Add to admin schema
adminSchema.add({
  version: { type: Number, default: 0 },
});

// Hooks
adminSchema.pre("save", async function (next) {
  if (this.isNew && this.accessLevel === "super") {
    this.$locals.isSuperAdminCreation = true;
    Object.keys(this.permissions).forEach((key) => {
      this.permissions[key] = true;
    });
  }

  if (this.isModified("accessLevel")) {
    if (this.accessLevel === "support") {
      this.permissions.manageUsers = false;
      this.permissions.manageRestaurants = false;
    } else if (this.accessLevel === "regional") {
      this.permissions.manageUsers = false;
    }
  }

  if (this.isNew) {
    try {
      await User.findByIdAndUpdate(
        this.user,
        { $set: { role: "admin" } },
        { runValidators: true }
      );
    } catch (err) {
      return next(new Error(`Failed to update user role: ${err.message}`));
    }
  }
  next();
});

adminSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoError" && error.code === 11000) {
    next(new Error("Admin or User already exists"));
  } else {
    next(error);
  }
});

adminSchema.pre("remove", async function (next) {
  try {
    await User.findByIdAndUpdate(
      this.user,
      { $set: { role: "user" } },
      { runValidators: true }
    );
    next();
  } catch (err) {
    next(new Error(`Failed to revert user role: ${err.message}`));
  }
});

// Methods
adminSchema.methods = {
  hasPermission(permission) {
    return this.accessLevel === "super" || this.permissions[permission];
  },

  async logActivity(action, ip, metadata = null) {
    try {
      this.activityLog.push({
        action,
        ipAddress: ip,
        metadata,
        timestamp: new Date(),
      });
      this.lastAccess = new Date();
      await this.save();
      return true;
    } catch (err) {
      console.error("Activity log error:", err);
      return false;
    }
  },

  checkRegionAccess(region) {
    if (this.accessLevel === "super") return true;
    if (this.accessLevel === "regional") {
      return this.assignedRegions.some((r) =>
        new RegExp(`^${r}`, "i").test(region)
      );
    }
    return false;
  },
};

// Statics
adminSchema.statics = {
  async createSuperAdmin(userId, creatorIp) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const existingAdmin = await this.findOne({ user: userId });
    if (existingAdmin) {
      throw new Error("User is already an admin");
    }

    const admin = new this({
      user: userId,
      accessLevel: "super",
      $locals: { isSuperAdminCreation: true },
    });

    await admin.save();
    await admin.logActivity("Super admin account created", creatorIp, {
      createdBy: "system",
    });

    return admin;
  },

  async findByUserId(userId) {
    return this.findOne({ user: userId })
      .populate("user", "fullName email avatar")
      .lean();
  },

  async getAdminsByPermission(permission) {
    return this.find({
      $or: [{ accessLevel: "super" }, { [`permissions.${permission}`]: true }],
      isActive: true,
    }).select("-activityLog");
  },
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
