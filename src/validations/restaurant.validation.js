import Joi from "joi";

export const createRestaurantSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    "string.base": `"name" should be a type of 'text'`,
    "string.empty": `"name" cannot be an empty field`,
    "string.min": `"name" should have a minimum length of {#limit}`,
    "string.max": `"name" should have a maximum length of {#limit}`,
    "any.required": `"name" is a required field`,
  }),

  slug: Joi.string()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      "string.base": `"slug" should be a type of 'text'`,
      "string.empty": `"slug" cannot be an empty field`,
      "string.pattern.base": `"slug" can only contain lowercase letters, numbers, and hyphens`,
      "string.min": `"slug" should have a minimum length of {#limit}`,
      "string.max": `"slug" should have a maximum length of {#limit}`,
      "any.required": `"slug" is a required field`,
    }),

  description: Joi.string().max(500).optional().messages({
    "string.base": `"description" should be a type of 'text'`,
    "string.empty": `"description" cannot be an empty field`,
    "string.max": `"description" should have a maximum length of {#limit}`,
  }),

  shortDescription: Joi.string().max(150).optional().messages({
    "string.base": `"shortDescription" should be a type of 'text'`,
    "string.empty": `"shortDescription" cannot be an empty field`,
    "string.max": `"shortDescription" should have a maximum length of {#limit}`,
  }),

  restaurantChain: Joi.string().max(100).optional().messages({
    "string.base": `"restaurantChain" should be a type of 'text'`,
    "string.empty": `"restaurantChain" cannot be an empty field`,
    "string.max": `"restaurantChain" should have a maximum length of {#limit}`,
  }),

  franchiseId: Joi.string().max(100).optional().messages({
    "string.base": `"franchiseId" should be a type of 'text'`,
    "string.empty": `"franchiseId" cannot be an empty field`,
    "string.max": `"franchiseId" should have a maximum length of {#limit}`,
  }),

  cuisineType: Joi.array()
    .items(
      Joi.string().valid(
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
        "Thai"
      )
    )
    .min(1)
    .required()
    .messages({
      "array.base": `"cuisineType" should be an array`,
      "array.includes": `"cuisineType" must contain valid cuisine types`,
      "array.min": `"cuisineType" must have at least one element`,
      "any.required": `"cuisineType" is a required field`,
    }),

  foodType: Joi.array()
    .items(
      Joi.string().valid(
        "Vegetarian",
        "Non-Vegetarian",
        "Vegan",
        "Eggitarian",
        "Jain"
      )
    )
    .min(1)
    .required()
    .messages({
      "array.base": `"foodType" should be an array`,
      "array.includes": `"foodType" must contain valid food types`,
      "array.min": `"foodType" must have at least one element`,
      "any.required": `"foodType" is a required field`,
    }),

  tags: Joi.array().items(Joi.string()).optional().messages({
    "array.base": `"tags" should be an array of strings`,
    "string.base": `"tags" should contain strings only`,
  }),

  location: Joi.object({
    address: Joi.string().required().messages({
      "string.base": `"location.address" should be a type of 'text'`,
      "string.empty": `"location.address" cannot be an empty field`,
      "any.required": `"location.address" is a required field`,
    }),
    landmark: Joi.string().optional(),
    city: Joi.string().required().messages({
      "string.base": `"location.city" should be a type of 'text'`,
      "string.empty": `"location.city" cannot be an empty field`,
      "any.required": `"location.city" is a required field`,
    }),
    state: Joi.string().optional(),
    pinCode: Joi.string()
      .pattern(/^[0-9]{6}$/)
      .required()
      .messages({
        "string.base": `"location.pinCode" should be a type of 'text'`,
        "string.empty": `"location.pinCode" cannot be an empty field`,
        "string.pattern.base": `"location.pinCode" should be a valid 6-digit pin code`,
        "any.required": `"location.pinCode" is a required field`,
      }),
    geoLocation: Joi.object({
      type: Joi.string().valid("Point").required(),
      coordinates: Joi.array()
        .items(Joi.number())
        .length(2)
        .required()
        .messages({
          "array.base": `"location.geoLocation.coordinates" should be an array of numbers`,
          "array.length": `"location.geoLocation.coordinates" must have exactly 2 coordinates (longitude, latitude)`,
        }),
    }).required(),
    zoneId: Joi.string().optional(),
  }),

  contact: Joi.object({
    phone: Joi.string().required().messages({
      "string.base": `"contact.phone" should be a type of 'text'`,
      "string.empty": `"contact.phone" cannot be an empty field`,
      "any.required": `"contact.phone" is a required field`,
    }),
    alternatePhone: Joi.string().optional(),
    email: Joi.string().email().required().messages({
      "string.base": `"contact.email" should be a type of 'text'`,
      "string.email": `"contact.email" should be a valid email address`,
      "any.required": `"contact.email" is a required field`,
    }),
    website: Joi.string().uri().optional().messages({
      "string.base": `"contact.website" should be a type of 'text'`,
      "string.uri": `"contact.website" should be a valid URL`,
    }),
  }),

  openingHours: Joi.array().items(
    Joi.object({
      day: Joi.string()
        .valid(
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday"
        )
        .required(),
      open: Joi.string().required(),
      close: Joi.string().required(),
      isClosed: Joi.boolean().default(false),
    })
  ),

  isOpenNow: Joi.boolean().default(false),
  holidays: Joi.array().items(Joi.date()).optional(),
  preparationTime: Joi.number().optional(),

  deliveryDetails: Joi.object({
    isDeliveryAvailable: Joi.boolean().default(true),
    isSelfDelivery: Joi.boolean().default(false),
    deliveryFee: Joi.number().default(0),
    minOrderAmount: Joi.number().default(0),
    freeDeliveryThreshold: Joi.number().optional(),
    deliveryRadius: Joi.number().optional(),
    estimatedDeliveryTime: Joi.object({
      min: Joi.number().default(30),
      max: Joi.number().default(45),
    }).optional(),
    deliverySlots: Joi.array()
      .items(
        Joi.object({
          startTime: Joi.string().required(),
          endTime: Joi.string().required(),
          maxOrders: Joi.number().required(),
        })
      )
      .optional(),
  }),

  priceRange: Joi.number().optional(),
  offers: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        description: Joi.string().optional(),
        code: Joi.string().optional(),
        discountType: Joi.string().valid("percentage", "fixed").required(),
        discountValue: Joi.number().required(),
        minOrderAmount: Joi.number().required(),
        validTill: Joi.date().required(),
      })
    )
    .optional(),

  isPureVeg: Joi.boolean().default(false),

  rating: Joi.object({
    overall: Joi.number().min(0).max(5).default(0),
    foodQuality: Joi.number().min(0).max(5).default(0),
    deliveryExperience: Joi.number().min(0).max(5).default(0),
    packaging: Joi.number().min(0).max(5).default(0),
  }),

  reviewCount: Joi.number().default(0),
  popularDishes: Joi.array().items(Joi.string()).optional(),

  logo: Joi.string().optional(),
  coverImage: Joi.string().optional(),
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        caption: Joi.string().optional(),
        isFeatured: Joi.boolean().optional(),
      })
    )
    .optional(),
  menuImages: Joi.array().items(Joi.string().uri()).optional(),

  menu: Joi.array()
    .items(
      Joi.object({
        category: Joi.string().required(),
        items: Joi.array().items(Joi.string()).required(),
      })
    )
    .optional(),

  owner: Joi.string().required(),
  managers: Joi.array().items(Joi.string()).optional(),

  fssaiLicenseNumber: Joi.string().optional(),
  gstNumber: Joi.string().optional(),

  isActive: Joi.boolean().default(true),
  isFeatured: Joi.boolean().default(false),
  isBusy: Joi.boolean().default(false),
  isAcceptingOrders: Joi.boolean().default(true),
  isVerified: Joi.boolean().default(false),

  viewCount: Joi.number().default(0),
  orderCount: Joi.number().default(0),
  lastOrderTime: Joi.date().optional(),
});

export default createRestaurantSchema;
