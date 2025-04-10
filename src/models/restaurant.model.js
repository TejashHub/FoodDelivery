import mongoose, { Schema } from "mongoose";
import MenuCategory from "./menuCategory.model.js";
import MenuItem from "./menuItem.model.js";
import DeliveryZone from "./deliveryZone.model.js";

const restaurantSchema = new Schema(
  {
    name: {
      type: String,
    },
    slug: {
      type: String,
    },
    description: {
      type: String,
    },
    shortDescription: {
      type: String,
    },
    restaurantChain: String,
    franchiseId: String,

    cuisineType: [
      {
        type: String,
        enum: [
          "North Indian",
          "South Indian",
          "Chinese",
          "Italian",
          "Mexican",
          "Continental",
          "Desserts",
          "Beverages",
          "Fast Food",
          "Vegan",
          "Street Food",
          "Bakery",
          "Seafood",
          "Arabian",
          "Japanese",
          "Thai",
        ],
      },
    ],
    foodType: [
      {
        type: String,
        enum: ["Vegetarian", "Non-Vegetarian", "Vegan", "Eggitarian", "Jain"],
      },
    ],
    tags: [String],

    location: {
      address: {
        type: String,
      },
      landmark: String,
      city: {
        type: String,
      },
      state: String,
      pinCode: {
        type: String,
      },
      geoLocation: {
        type: {
          type: String,
          default: "Point",
          enum: ["Point"],
        },
        coordinates: {
          type: [Number],
        },
      },
      zoneId: { type: Schema.Types.ObjectId, ref: "DeliveryZone" },
    },
    contact: {
      phone: {
        type: String,
      },
      alternatePhone: String,
      email: {
        type: String,
      },
      website: String,
    },
    type: {
      restaurant: { type: Boolean, required: true },
      dineIn: { type: Boolean, required: true },
      cloudKitchen: { type: Boolean, required: true },
    },
    openingHours: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
        },
        open: { type: String },
        close: { type: String },
        isClosed: { type: Boolean, default: false },
      },
    ],
    isOpenNow: { type: Boolean, default: false },
    holidays: [Date],
    preparationTime: {
      type: Number,
    },

    deliveryDetails: {
      isDeliveryAvailable: { type: Boolean, default: true },
      isSelfDelivery: { type: Boolean, default: false },
      deliveryFee: { type: Number, default: 0 },
      minOrderAmount: { type: Number, default: 0 },
      freeDeliveryThreshold: Number,
      deliveryRadius: Number,
      estimatedDeliveryTime: {
        min: { type: Number, default: 30 },
        max: { type: Number, default: 45 },
      },
      deliverySlots: [
        {
          startTime: String,
          endTime: String,
          maxOrders: Number,
        },
      ],
    },

    priceRange: {
      type: Number,
    },
    offers: [
      {
        title: String,
        description: String,
        code: String,
        discountType: { type: String, enum: ["percentage", "fixed"] },
        discountValue: Number,
        minOrderAmount: Number,
        validTill: Date,
      },
    ],
    isPureVeg: { type: Boolean, default: false },

    rating: {
      overall: { type: Number, default: 0, min: 0, max: 5 },
      foodQuality: { type: Number, default: 0, min: 0, max: 5 },
      deliveryExperience: { type: Number, default: 0, min: 0, max: 5 },
      packaging: { type: Number, default: 0, min: 0, max: 5 },
    },
    reviewCount: { type: Number, default: 0 },
    popularDishes: [String],

    logo: String,
    logoPublicId: String,
    coverImage: String,
    images: [
      {
        url: String,
        caption: String,
        isFeatured: Boolean,
        publicId: String,
      },
    ],
    menuImages: [String],

    menu: [
      {
        category: { type: Schema.Types.ObjectId, ref: "MenuCategory" },
        items: [{ type: Schema.Types.ObjectId, ref: "MenuItem" }],
      },
    ],

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    managers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    fssaiLicenseNumber: {
      type: String,
    },
    gstNumber: String,

    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isBusy: { type: Boolean, default: false },
    isAcceptingOrders: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },

    viewCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    lastOrderTime: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

restaurantSchema.index({ "location.geoLocation": "2dsphere" });

restaurantSchema.index({
  name: "text",
  description: "text",
  cuisineType: "text",
  "location.city": "text",
  "location.address": "text",
  tags: "text",
});

restaurantSchema.virtual("averageRating").get(function () {
  return (
    (this.rating.overall +
      this.rating.foodQuality +
      this.rating.deliveryExperience) /
    3
  ).toFixed(1);
});

const Restaurant = mongoose.model("Restaurant", restaurantSchema);

export default Restaurant;
