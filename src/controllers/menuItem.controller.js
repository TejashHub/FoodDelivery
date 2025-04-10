import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import {
  removeFileToCloudinary,
  uploadFileToCloudinary,
} from "../config/cloudinary.config.js";
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
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid id");
    }

    const existingItem = await MenuItem.findById(id);
    if (!existingItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    const {
      name,
      price,
      images,
      isAvailable,
      ingredients,
      dietaryTags,
      customizationOptions,
      addonGroups,
      categoryId,
      restaurantId,
    } = req.body;

    const bulkImages = req.files?.images;
    let uploads = [];

    if (bulkImages && bulkImages.length > 0) {
      uploads = await Promise.all(
        bulkImages.map(async (item) => {
          const upload = await uploadFileToCloudinary(item.path);
          if (!upload) {
            throw new ApiError(
              StatusCodes.BAD_REQUEST,
              "Error while uploading images"
            );
          }
          return upload.url;
        })
      );
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid restaurant ID");
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category ID");
    }

    if (!name || typeof name !== "string") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Name must be a valid string"
      );
    }

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
      typeof customizationOptions === "string"
        ? JSON.parse(customizationOptions)
        : customizationOptions;

    const parsedAddonGroups =
      typeof addonGroups === "string" ? JSON.parse(addonGroups) : addonGroups;

    const updatedItem = await MenuItem.findByIdAndUpdate(
      id,
      {
        name,
        price: parsedPrice,
        isAvailable: parsedIsAvailable,
        ingredients: parsedIngredients,
        dietaryTags: parsedTags,
        customizationOptions: parsedCustomizationOptions,
        addonGroups: parsedAddonGroups,
        images: uploads,
        categoryId,
        restaurantId,
      },
      { new: true }
    );

    return new ApiResponse(
      StatusCodes.OK,
      { data: updatedItem },
      "Menu item updated successfully"
    ).send(res);
  }),

  deleteMenuItem: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const menuItem = await MenuItem.findById(id);
    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    if (menuItem.images && menuItem.images.length > 0) {
      await Promise.all(
        menuItem.images.map(async (image) => {
          const remove = await removeFileToCloudinary(image);
          if (!remove) {
            throw new ApiError(
              StatusCodes.BAD_REQUEST,
              "Error deleting image from Cloudinary."
            );
          }
        })
      );
    }

    const deleteMenuItem = await MenuItem.findByIdAndDelete(id);

    if (!deleteMenuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Item not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  }),

  // Special Features
  toggleMenuItemAvailability: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    menuItem.isAvailable = !menuItem.isAvailable;

    await menuItem.save();

    return new ApiResponse(
      StatusCodes.OK,
      {
        isAvailable: menuItem.isAvailable,
      },
      `Menu item ${menuItem.isAvailable ? "activated" : "deactivated"}`
    ).send(res);
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

    return new ApiResponse(
      StatusCodes.OK,
      { rating: menuItem.rating },
      "Rating updated successfully"
    ).send(res);
  }),

  searchMenuItems: asyncHandler(async (req, res) => {
    const {
      query,
      isVeg,
      minPrice,
      maxPrice,
      dietaryTags,
      sortBy,
      order = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // Text Search
    if (query && query.trim().length >= 3) {
      filter.$text = { $search: query };
    }

    // Veg Filter
    if (isVeg === "true" || isVeg === "false") {
      filter.isVeg = isVeg === "true";
    }

    // Price Filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Dietary Tags Filter
    if (dietaryTags) {
      const tagsArray = dietaryTags.split(",").map((tag) => tag.trim());
      filter.dietaryTags = { $all: tagsArray };
    }

    // Sorting
    const sortOptions = {};
    if (sortBy) {
      const allowedSortFields = [
        "price",
        "rating.value",
        "orderCount",
        "createdAt",
      ];
      if (allowedSortFields.includes(sortBy)) {
        sortOptions[sortBy] = order === "asc" ? 1 : -1;
      }
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Query Execution
    const [results, totalCount] = await Promise.all([
      MenuItem.find(filter).sort(sortOptions).skip(skip).limit(Number(limit)),
      MenuItem.countDocuments(filter),
    ]);

    return new ApiResponse(
      StatusCodes.OK,
      {
        results,
        total: totalCount,
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
      "Search completed successfully"
    ).send(res);
  }),

  updateBestSellerStatus: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    menuItem.isBestSeller = !menuItem.isBestSeller;
    await menuItem.save();

    return new ApiResponse(
      StatusCodes.OK,
      {
        isBestSeller: menuItem.isBestSeller,
      },
      {
        message: `Best seller status ${
          menuItem.isBestSeller ? "added" : "removed"
        }`,
      }
    ).send(res);
  }),

  updateMenuItemImages: asyncHandler(async (req, res) => {
    const { operation, images } = req.body;
    const { id } = req.params;

    if (!["add", "remove"].includes(operation)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid operation");
    }

    const update =
      operation === "add"
        ? { $push: { images: { $each: images } } }
        : { $pull: { images: { $in: images } } };

    const menuItem = await MenuItem.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      { images: menuItem.images },
      "Images updated successfully"
    ).send(res);
  }),

  incrementOrderCount: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const menuItem = await MenuItem.findByIdAndUpdate(
      id,
      { $inc: { orderCount: 1 } },
      { new: true }
    );

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      { orderCount: menuItem.orderCount },
      "Order count incremented"
    ).send(res);
  }),

  updateCustomizationOptions: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { customizationOptions } = req.body;

    const menuItem = await MenuItem.findByIdAndUpdate(
      id,
      { customizationOptions },
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      { customizationOptions: menuItem.customizationOptions },
      "Customization options updated"
    ).send(res);
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

    return new ApiResponse(
      StatusCodes.OK,
      { addonGroups: menuItem.addonGroups },
      "Addon groups updated"
    ).send(res);
  }),
};

export default MenuItemController;
