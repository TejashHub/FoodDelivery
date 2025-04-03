import mongoose from "mongoose";

const menuCategorySchema = new mongoose.Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      maxlength: 300,
    },
    shortDescription: {
      type: String,
      maxlength: 60,
    },
    image: {
      url: String,
      thumbnailUrl: String,
      altText: String,
    },
    icon: String,
    colorCode: String,
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFeatured: { type: Boolean, default: false },
    featuredOrder: Number,
    isPopular: { type: Boolean, default: false },
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
      },
    ],
    itemCount: {
      type: Number,
      default: 0,
    },
    availableTimes: {
      start: String,
      end: String,
    },
    isTimeRestricted: { type: Boolean, default: false },
    daysAvailable: {
      type: [String],
      enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      default: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    metadata: {
      seoTitle: String,
      seoDescription: String,
      keywords: [String],
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

menuCategorySchema.index({ restaurant: 1, displayOrder: 1 });
menuCategorySchema.index({ restaurant: 1, isFeatured: 1 });
menuCategorySchema.index({ restaurant: 1, isPopular: 1 });
menuCategorySchema.index({ slug: 1 }, { unique: true });

menuCategorySchema.virtual("featuredItems", {
  ref: "MenuItem",
  localField: "_id",
  foreignField: "category",
  match: { isFeatured: true },
});

menuCategorySchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "-");
  }
  next();
});

menuCategorySchema.methods.isCurrentlyAvailable = function () {
  if (!this.isActive) return false;
  const currentDay = new Date()
    .toLocaleString("en-us", { weekday: "short" })
    .toLowerCase();
  if (!this.daysAvailable.includes(currentDay)) return false;

  if (this.isTimeRestricted) {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    const [startHour, startMinute] = this.availableTimes.start
      .split(":")
      .map(Number);
    const [endHour, endMinute] = this.availableTimes.end.split(":").map(Number);

    const currentTime = currentHours * 60 + currentMinutes;
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    return currentTime >= startTime && currentTime <= endTime;
  }
  return true;
};

const MenuCategory = mongoose.model("MenuCategory", menuCategorySchema);

export default MenuCategory;
