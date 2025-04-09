import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import { uploadFileToCloudinary } from "../config/cloudinary.config.js";
import MenuItem from "../models/menuItem.model.js";
import asyncHandler from "../middleware/asyncHandler.middleware.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";

const MenuItemController = {
  // Core CRUD
  createMenuItem: asyncHandler(async (req, res) => {
    const {
      itemId,
      restaurantId,
      categoryId,
      name,
      price,
      isAvailable,
      ingredients,
      dietaryTags,
    } = req.body;

    const imageUploadResults = await Promise.all(
      req.files.images.map(async (image) => {
        const upload = await uploadFileToCloudinary(image.path);
        if (!upload?.url) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            "Error while uploading image to Cloudinary"
          );
        }
        return upload.url;
      })
    );

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid restaurant ID");
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category ID");
    }

    [itemId, name].forEach((item) => {
      if (!item || typeof item !== "string") {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Item ID and Name must be valid strings"
        );
      }
    });

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Price must be a non-negative number"
      );
    }

    const parsedIsAvailable = isAvailable === "true" || isAvailable === true;

    const parsedIngredients =
      typeof ingredients === "string" ? JSON.parse(ingredients) : ingredients;
    if (!Array.isArray(parsedIngredients)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Ingredients must be an array"
      );
    }

    const allowedDietaryTags = [
      "Gluten-Free",
      "Vegan",
      "Jain",
      "Eggless",
      "Contains Nuts",
    ];
    const parsedTags =
      typeof dietaryTags === "string" ? JSON.parse(dietaryTags) : dietaryTags;
    if (!Array.isArray(parsedTags)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Dietary tags must be an array"
      );
    }
    const invalidTags = parsedTags.filter(
      (tag) => !allowedDietaryTags.includes(tag)
    );
    if (invalidTags.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid dietary tags: ${invalidTags.join(", ")}`
      );
    }

    const parsedCustomizationOptions =
      typeof req.body.customizationOptions === "string"
        ? JSON.parse(req.body.customizationOptions)
        : req.body.customizationOptions;

    const parsedAddonGroups =
      typeof req.body.addonGroups === "string"
        ? JSON.parse(req.body.addonGroups)
        : req.body.addonGroups;

    const existingItem = await MenuItem.findOne({ itemId });
    if (existingItem) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Item ID must be unique");
    }

    const cleanName = name.trim();
    const cleanItemId = itemId.trim();

    const menuItem = await MenuItem.create({
      itemId: cleanItemId,
      name: cleanName,
      restaurantId,
      categoryId,
      price: parsedPrice,
      isAvailable: parsedIsAvailable,
      ingredients: parsedIngredients,
      customizationOptions: parsedCustomizationOptions,
      addonGroups: parsedAddonGroups,
      dietaryTags: parsedTags,
      images: imageUploadResults,
    });

    return new ApiResponse(
      StatusCodes.CREATED,
      { data: menuItem },
      "Menu item created successfully"
    ).send(res);
  }),

  getAllMenuItems: asyncHandler(async (req, res) => {
    const {
      restaurantId,
      categoryId,
      isVeg,
      isAvailable,
      dietaryTags,
      minPrice,
      maxPrice,
      sortBy,
      search,
    } = req.query;

    const filter = {};

    if (restaurantId) filter.restaurantId = restaurantId;
    if (categoryId) filter.categoryId = categoryId;
    if (isVeg) filter.isVeg = isVeg === "true";
    if (isAvailable) filter.isAvailable = isAvailable === "true";

    if (dietaryTags) {
      filter.dietaryTags = { $in: dietaryTags.split(",") };
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Full-text search
    if (search) {
      filter.$text = { $search: search };
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      popular: { orderCount: -1 },
      priceAsc: { price: 1 },
      priceDesc: { price: -1 },
    };

    const sort = sortOptions[sortBy] || { createdAt: -1 };

    const menuItems = await MenuItem.find(filter)
      .sort(sort)
      .populate("restaurantId", "name")
      .populate("categoryId", "name");

    return new ApiResponse(
      StatusCodes.OK,
      { data: menuItems },
      "All menu items fetched successfully"
    ).send(res);
  }),

  getMenuItemById: asyncHandler(async (req, res) => {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate("restaurantId", "name address")
      .populate("categoryId", "name");

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      { data: menuItem },
      "Item fetched successfully"
    ).send(res);
  }),

  updateMenuItem: asyncHandler(async (req, res) => {
    const allowedUpdates = [
      "name",
      "description",
      "price",
      "discountPrice",
      "isVeg",
      "ingredients",
      "dietaryTags",
      "customizationOptions",
      "addonGroups",
      "images",
      "preparationTime",
      "isAvailable",
      "isBestSeller",
    ];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid update fields");
    }

    const menuItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Menu item updated successfully",
      data: menuItem,
    });
  }),

  deleteMenuItem: asyncHandler(async (req, res) => {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  }),

  // Special Features
  toggleMenuItemAvailability: asyncHandler(async (req, res) => {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    menuItem.isAvailable = !menuItem.isAvailable;

    await menuItem.save();
    res.status(StatusCodes.OK).json({
      success: true,
      message: `Menu item ${
        menuItem.isAvailable ? "activated" : "deactivated"
      }`,
      data: { isAvailable: menuItem.isAvailable },
    });
  }),

  updateMenuItemRating: asyncHandler(async (req, res) => {
    const { rating } = req.body;

    if (rating < 1 || rating > 5) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Rating must be between 1 and 5"
      );
    }

    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    const newTotal = menuItem.rating.value * menuItem.rating.count + rating;
    const newCount = menuItem.rating.count + 1;

    menuItem.rating.value = newTotal / newCount;
    menuItem.rating.count = newCount;

    await menuItem.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Rating updated successfully",
      data: { rating: menuItem.rating },
    });
  }),

  searchMenuItems: asyncHandler(async (req, res) => {
    const { query } = req.query;

    if (!query || query.trim().length < 3) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Search query must be at least 3 characters"
      );
    }

    const results = await MenuItem.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } });

    res.status(StatusCodes.OK).json({
      success: true,
      data: results,
    });
  }),

  updateBestSellerStatus: asyncHandler(async (req, res) => {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    menuItem.isBestSeller = !menuItem.isBestSeller;
    await menuItem.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Best seller status ${
        menuItem.isBestSeller ? "added" : "removed"
      }`,
      data: { isBestSeller: menuItem.isBestSeller },
    });
  }),

  updateMenuItemImages: asyncHandler(async (req, res) => {
    const { operation, images } = req.body;

    if (!["add", "remove"].includes(operation)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid operation");
    }

    const update =
      operation === "add"
        ? { $push: { images: { $each: images } } }
        : { $pull: { images: { $in: images } } };

    const menuItem = await MenuItem.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Images updated successfully",
      data: { images: menuItem.images },
    });
  }),

  incrementOrderCount: asyncHandler(async (req, res) => {
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { $inc: { orderCount: 1 } },
      { new: true }
    );

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Order count incremented",
      data: { orderCount: menuItem.orderCount },
    });
  }),

  updateCustomizationOptions: asyncHandler(async (req, res) => {
    const { customizationOptions } = req.body;

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { customizationOptions },
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Customization options updated",
      data: { customizationOptions: menuItem.customizationOptions },
    });
  }),

  updateAddonGroups: asyncHandler(async (req, res) => {
    const { addonGroups } = req.body;

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { addonGroups },
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Addon groups updated",
      data: { addonGroups: menuItem.addonGroups },
    });
  }),
};

export default MenuItemController;
