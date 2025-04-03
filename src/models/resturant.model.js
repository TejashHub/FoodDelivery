import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema(
  {
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
      maxlength: 500,
    },
    shortDescription: {
      type: String,
      maxlength: 100,
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
        required: true,
      },
      landmark: String,
      city: {
        type: String,
        required: true,
      },
      state: String,
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
        type: {
          type: String,
          default: "Point",
          enum: ["Point"],
        },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator: function (v) {
              return (
                v.length === 2 &&
                v[0] >= -180 &&
                v[0] <= 180 &&
                v[1] >= -90 &&
                v[1] <= 90
              );
            },
          },
        },
      },
      zoneId: { type: Schema.Types.ObjectId, ref: "DeliveryZone" },
    },

    contact: {
      phone: {
        type: String,
        required: true,
        validate: {
          validator: function (v) {
            return /^[0-9]{10}$/.test(v);
          },
        },
      },
      alternatePhone: String,
      email: {
        type: String,
        lowercase: true,
        validate: {
          validator: function (v) {
            return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
          },
        },
      },
      website: String,
    },

    type: Map,
    openingHours: {
      of: new Schema({
        open: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
        close: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
        isClosed: { type: Boolean, default: false },
      }),
      default: {
        monday: { open: "10:00", close: "22:00" },
        tuesday: { open: "10:00", close: "22:00" },
        wednesday: { open: "10:00", close: "22:00" },
        thursday: { open: "10:00", close: "22:00" },
        friday: { open: "10:00", close: "22:00" },
        saturday: { open: "10:00", close: "23:00" },
        sunday: { open: "10:00", close: "23:00" },
      },
    },
    isOpenNow: { type: Boolean, default: false },
    holidays: [Date],
    preparationTime: {
      type: Number,
      min: 5,
      max: 120,
      default: 25,
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
      min: 1,
      max: 4,
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
    coverImage: String,
    images: [
      {
        url: String,
        caption: String,
        isFeatured: Boolean,
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
      validate: {
        validator: function (v) {
          return /^[0-9]{14}$/.test(v);
        },
      },
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

restaurantSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  }
  next();
});

restaurantSchema.methods.checkOpenStatus = function () {
  const now = new Date();
  const day = now.toLocaleString("en-us", { weekday: "long" }).toLowerCase();
  const currentHours = this.openingHours.get(day);

  if (!currentHours || currentHours.isClosed) return false;

  const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
  const [openHour, openMinute] = currentHours.open.split(":").map(Number);
  const [closeHour, closeMinute] = currentHours.close.split(":").map(Number);

  const currentTime = currentHour * 60 + currentMinute;
  const openTime = openHour * 60 + openMinute;
  const closeTime = closeHour * 60 + closeMinute;

  return currentTime >= openTime && currentTime <= closeTime;
};

const Restaurant = mongoose.model("Restaurant", restaurantSchema);

export default Restaurant;
