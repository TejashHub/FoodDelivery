// Database
import mongoose from "mongoose";

// External Package
import { StatusCodes } from "http-status-codes";
import sharp from "sharp";

// Models
import Restaurant from "../models/restaurant.model.js";
import MenuCategory from "../models/menuCategory.model.js";
import MenuItem from "../models/menuItem.model.js";

// Config
import {
  uploadFileToCloudinary,
  removeFileToCloudinary,
} from "../config/cloudinary.config.js";

// Middleware
import asyncHandler from "../middleware/asyncHandler.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";

// Utils
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";

export const MenuCategoryController = {
  // Core CRUD Operations
  getAllMenuCategoryController: asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, sort = "displayOrder" } = req.query;
    const skip = (page - 1) * limit;

    const categories = await MenuCategory.find()
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("restaurant", "name logo")
      .populate("items", "name price");

    const total = await MenuCategory.countDocuments();

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: { categories },
        meta: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      "Categories retrieved successfully"
    ).send(res);
  }),

  getMenuCategoryController: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category ID");
    }

    const category = await MenuCategory.findById(id)
      .populate("restaurant", "name address")
      .populate("items", "name price image")
      .populate("createdBy", "name email");

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      { data: category },
      "Category retrieved successfully"
    ).send(res);
  }),

  createMenuCategoryController: asyncHandler(async (req, res) => {
    const { restaurantId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid id");
    }

    const imageFilePaths = req.file?.path;

    const upload = await uploadFileToCloudinary(imageFilePaths);

    if (!upload) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "failed to upload file");
    }

    const restaurantExit = await Restaurant.findById(restaurantId);

    if (!restaurantExit) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found");
    }

    const existCategory = await MenuCategory.findById(restaurantId);

    if (existCategory) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Category already exists for this restaurant."
      );
    }

    const category = await MenuCategory.create({
      ...req.body,
      restaurant: restaurantId,
      image: {
        url: upload.url,
        thumbnailUrl: upload.url,
        altText: upload.display_name,
      },
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
    });

    return new ApiResponse(
      StatusCodes.CREATED,
      category,
      "Category created successfully"
    ).send(res);
  }),

  updateMenuCategoryController: asyncHandler(async (req, res) => {
    const { id } = req.params;
    let updateData = { ...req.body };

    // Validate the category ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category ID");
    }

    // Check if the restaurant field is being updated
    if (updateData.hasOwnProperty("restaurant")) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Cannot change category restaurant"
      );
    }

    // Handle image upload if a file is provided
    if (req.file?.path) {
      const upload = await uploadFileToCloudinary(req.file.path);
      if (!upload) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to upload file");
      }
      updateData.image = {
        url: upload.url,
        thumbnailUrl: upload.url, // Assuming the same URL for simplicity
        altText: upload.display_name || "Category image",
      };
    }

    // Perform the update
    const category = await MenuCategory.findByIdAndUpdate(
      id,
      { ...updateData, lastUpdatedBy: req.user._id },
      { new: true, runValidators: true }
    );

    // Check if the category was found and updated
    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    // Send the response
    return new ApiResponse(
      StatusCodes.OK,
      { category },
      "Category updated successfully"
    ).send(res);
  }),

  deleteMenuCategoryController: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category ID");
    }

    const categoryWithItems = await MenuCategory.findById(id).select("items");

    if (!categoryWithItems) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    if (categoryWithItems.items.length > 0) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Cannot delete category with existing items"
      );
    }

    const category = await MenuCategory.findByIdAndDelete(id);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      "Category deleted successfully"
    ).send(res);
  }),

  // Availability Management
  availabilityCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid id");
    }

    const category = await MenuCategory.findByIdAndUpdate(
      id,
      {
        isActive,
        lastUpdatedBy: req.user._id,
      },
      { new: true }
    );

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      { data: category },
      `Category ${isActive ? "activated" : "deactivated"} successfully`
    );
  }),

  availableTimesCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { start, end, isTimeRestricted } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid id");
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (start && !timeRegex.test(start)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid start time format (HH:MM)"
      );
    }
    if (end && !timeRegex.test(end)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid end time format (HH:MM)"
      );
    }

    const updateData = {
      lastUpdatedBy: req.user._id,
      ...(start && { "availableTimes.start": start }),
      ...(end && { "availableTimes.end": end }),
      ...(typeof isTimeRestricted === "boolean" && { isTimeRestricted }),
    };

    const category = await MenuCategory.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      {
        availableTimes: category.availableTimes,
        isTimeRestricted: category.isTimeRestricted,
      },
      "Category availability days updated"
    ).send(res);
  }),

  availableDaysCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { daysAvailable } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid id");
    }

    if (!Array.isArray(daysAvailable)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "daysAvailable must be an array"
      );
    }

    const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const invalidDays = daysAvailable.filter((day) => !validDays.includes(day));

    if (invalidDays.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid days: ${invalidDays.join(
          ", "
        )}. Valid days are: ${validDays.join(", ")}`
      );
    }

    const category = await MenuCategory.findByIdAndUpdate(
      id,
      {
        daysAvailable,
        lastUpdatedBy: req.user._id,
      },
      { new: true }
    );

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: { daysAvailable: category.daysAvailable },
      },
      "Category available days updated"
    ).send(res);
  }),

  checkAvailabilityCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid id");
    }

    const category = await MenuCategory.findById(id);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    const isAvailable = category.isCurrentlyAvailable();

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: {
          isAvailable,
          currentDay: new Date()
            .toLocaleString("en-us", { weekday: "short" })
            .toLowerCase(),
          currentTime: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          requirements: {
            isActive: category.isActive,
            daysAvailable: category.daysAvailable,
            ...(category.isTimeRestricted && {
              availableTimes: category.availableTimes,
            }),
          },
        },
      },
      isAvailable
        ? "Category is currently available"
        : "Category is not available"
    ).send(res);
  }),

  // PENDING

  // Item Relationships
  itemsCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const category = await MenuCategory.findById(id).populate({
      path: "items",
      options: {
        skip,
        limit,
        sort: { price: 1 },
      },
      select: "name price image isAvailable",
    });

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    const totalItems = await MenuItem.countDocuments({ category: id });

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Category items retrieved",
      data: {
        items: category.items,
        categoryName: category.name,
      },
      meta: {
        page: Number(page),
        limit: Number(limit),
        total: totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  }),

  itemsFeaturedCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await MenuCategory.findById(id).populate({
      path: "featuredItems",
      select: "name price image description",
      match: { isAvailable: true },
    });

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Featured items retrieved",
      data: {
        featuredItems: category.featuredItems,
        category: {
          name: category.name,
          isFeatured: category.isFeatured,
        },
      },
    });
  }),

  countCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [count, category] = await Promise.all([
      MenuItem.countDocuments({ category: id }),
      MenuCategory.findById(id).select("name"),
    ]);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Item count retrieved",
      data: {
        category: category.name,
        itemCount: count,
        hasItems: count > 0,
      },
    });
  }),

  createItemCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { menuItemId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid menu item ID");
    }

    const [category, menuItem] = await Promise.all([
      MenuCategory.findById(id),
      MenuItem.findById(menuItemId),
    ]);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    if (category.items.includes(menuItemId)) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Item already exists in category"
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      category.items.push(menuItemId);
      category.itemCount += 1;
      await category.save({ session });

      menuItem.category = id;
      await menuItem.save({ session });

      await session.commitTransaction();

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Item added to category",
        data: {
          category: category.name,
          item: menuItem.name,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }),

  deleteItemCategory: asyncHandler(async (req, res) => {
    const { id, itemId } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const category = await MenuCategory.findByIdAndUpdate(
        id,
        {
          $pull: { items: itemId },
          $inc: { itemCount: -1 },
          lastUpdatedBy: req.user._id,
        },
        { new: true, session }
      );

      if (!category) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
      }

      await MenuItem.findByIdAndUpdate(
        itemId,
        { $unset: { category: "" } },
        { session }
      );

      await session.commitTransaction();

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Item removed from category",
        data: {
          remainingItems: category.itemCount,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }),

  // END PENDING

  // Display & Ordering
  displayOrderCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { displayOrder } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid id");
    }

    if (typeof displayOrder !== "number" || displayOrder < 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Display order must be a positive number"
      );
    }

    const category = await MenuCategory.findByIdAndUpdate(
      id,
      {
        displayOrder,
        lastUpdatedBy: req.user._id,
      },
      { new: true }
    );

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      {
        category: {
          name: category.name,
          newOrder: category.displayOrder,
          restaurant: category.restaurant,
        },
      },
      "Display order updated"
    ).send(res);
  }),

  featuredOrderCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { featuredOrder } = req.body;

    if (typeof featuredOrder !== "number") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Featured order must be a number"
      );
    }

    const [category] = await Promise.all([
      MenuCategory.findByIdAndUpdate(
        id,
        {
          featuredOrder,
          isFeatured: true,
          lastUpdatedBy: req.user._id,
        },
        { new: true }
      ).select("name featuredOrder isFeatured"),

      featuredOrder === 1 &&
        MenuCategory.updateMany(
          {
            _id: { $ne: id },
            featuredOrder: 1,
          },
          { $inc: { featuredOrder: 1 } }
        ),
    ]);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      {
        category: {
          name: category.name,
          isFeatured: category.isFeatured,
          featuredOrder: category.featuredOrder,
        },
      },
      "Featured order updated"
    ).send(res);
  }),

  sortedCategory: asyncHandler(async (req, res) => {
    const { sortBy = "displayOrder", sortDirection = "asc" } = req.query;

    console.log("Welcome");

    const validSortFields = [
      "displayOrder",
      "name",
      "createdAt",
      "featuredOrder",
    ];
    const validDirections = ["asc", "desc"];

    if (!validSortFields.includes(sortBy)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid sort field. Valid fields are: ${validSortFields.join(", ")}`
      );
    }

    if (!validDirections.includes(sortDirection)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid sort direction. Use 'asc' or 'desc'`
      );
    }

    const sort = {};
    sort[sortBy] = sortDirection === "asc" ? 1 : -1;

    const categories = await MenuCategory.find()
      .sort(sort)
      .select("name displayOrder featuredOrder isFeatured")
      .limit(100);

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: { categories },
        meta: {
          sortBy,
          sortDirection,
          count: categories.length,
        },
      },
      `Categories sorted by ${sortBy} (${sortDirection})`
    ).send(res);
  }),

  reorderCategory: asyncHandler(async (req, res) => {
    const { newOrder } = req.body;

    if (!Array.isArray(newOrder) || newOrder.length === 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "New order array is required"
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const bulkOps = newOrder.map(({ id, displayOrder }) => ({
        updateOne: {
          filter: { _id: id },
          update: {
            displayOrder,
            lastUpdatedBy: req.user._id,
          },
        },
      }));

      const result = await MenuCategory.bulkWrite(bulkOps, { session });

      if (result.matchedCount !== newOrder.length) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Some categories not found"
        );
      }

      await session.commitTransaction();

      return new ApiResponse(
        StatusCodes.OK,
        {
          updatedCount: result.modifiedCount,
        },
        `${newOrder.length} categories reordered`
      ).send(res);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }),

  // Media Management
  createCategoryImage: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { altText } = req.body;

    const imageFilePath = req?.file;

    if (!imageFilePath) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Image file is required");
    }

    const imagePath = req.file.path;
    const thumbnailPath = `${imagePath}-thumbnail`;

    try {
      await sharp(req.file.path).resize(200, 200).toFile(thumbnailPath);

      const [imageResult, thumbnailResult] = await Promise.all([
        await uploadFileToCloudinary(imagePath),
        await uploadFileToCloudinary(thumbnailPath),
      ]);

      if (!imageResult || !thumbnailResult) {
        throw new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Image upload failed"
        );
      }

      const category = await MenuCategory.findByIdAndUpdate(
        id,
        {
          image: {
            url: imageResult.url,
            thumbnailUrl: thumbnailResult.url,
            altText: altText || `Image for ${req.file.originalname}`,
          },
          lastUpdatedBy: req.user._id,
        },
        { new: true }
      ).select("name image");

      if (!category) {
        await Promise.all([
          removeFileToCloudinary(imageResult.public_id),
          removeFileToCloudinary(thumbnailResult.public_id),
        ]);
        throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
      }

      return new ApiResponse(
        StatusCodes.OK,
        {
          category: {
            name: category.name,
            image: category.image,
          },
        },
        "Image uploaded successfully"
      ).send(res);
    } catch (error) {
      throw error;
    }
  }),

  updateCategoryImage: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { altText } = req.body;

    const imageFilePath = req?.file;

    if (!imageFilePath) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Image file is required");
    }

    const category = await MenuCategory.findById(id).select("image");

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    const imagePath = req.file.path;
    const thumbnailPath = `${imagePath}-thumbnail`;

    try {
      await sharp(req.file.path).resize(200, 200).toFile(thumbnailPath);

      const [imageResult, thumbnailResult] = await Promise.all([
        uploadFileToCloudinary(imagePath),
        uploadFileToCloudinary(thumbnailPath),
      ]);

      if (!imageResult || !thumbnailResult) {
        throw new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Image upload failed"
        );
      }

      if (category.image?.url) {
        const oldPublicId = category.image.url.split("/").pop().split(".")[0];
        await removeFileToCloudinary(oldPublicId);
      }

      if (category.image?.thumbnailUrl) {
        const oldThumbnailPublicId = category.image.thumbnailUrl
          .split("/")
          .pop()
          .split(".")[0];
        await removeFileToCloudinary(oldThumbnailPublicId);
      }

      const updatedCategory = await MenuCategory.findByIdAndUpdate(
        id,
        {
          image: {
            url: imageResult.url,
            thumbnailUrl: thumbnailResult.url,
            altText:
              altText ||
              category.image?.altText ||
              `Image for ${req.file.originalname}`,
          },
          lastUpdatedBy: req.user._id,
        },
        { new: true }
      ).select("name image");

      return new ApiResponse(
        StatusCodes.OK,
        {
          data: {
            category: {
              name: updatedCategory.name,
              image: updatedCategory.image,
            },
          },
        },
        "Image updated successfully"
      ).send(res);
    } catch (error) {
      throw error;
    }
  }),

  deleteCategoryImage: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await MenuCategory.findById(id).select("image");

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    if (!category.image?.url) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "No image exists to delete");
    }

    try {
      const publicId = category.image.url.split("/").pop().split(".")[0];
      const thumbnailPublicId = category.image.thumbnailUrl
        ?.split("/")
        .pop()
        .split(".")[0];
      await Promise.all([
        removeFileToCloudinary(publicId),
        thumbnailPublicId && removeFileToCloudinary(thumbnailPublicId),
      ]);

      const updatedCategory = await MenuCategory.findByIdAndUpdate(
        id,
        {
          $unset: { image: 1 },
          lastUpdatedBy: req.user._id,
        },
        { new: true }
      ).select("name");

      return new ApiResponse(
        StatusCodes.OK,
        {
          data: {
            category: {
              name: updatedCategory.name,
              image: null,
            },
          },
        },
        "Image deleted successfully"
      ).send(req);
    } catch (error) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Image deletion failed: " + error.message
      );
    }
  }),

  // Search & Filter
  searchCategory: asyncHandler(async (req, res) => {
    const { query, page = 1, limit = 10 } = req.body;

    if (!query || query.trim().length < 2) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Search query must be at least 2 characters long"
      );
    }

    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(query, "i");

    const [categories, total] = await Promise.all([
      MenuCategory.find({
        $or: [
          { name: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { shortDescription: { $regex: searchRegex } },
        ],
      })
        .skip(skip)
        .limit(limit)
        .select("name description image isActive")
        .populate("restaurant", "name"),

      MenuCategory.countDocuments({
        $or: [
          { name: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { shortDescription: { $regex: searchRegex } },
        ],
      }),
    ]);

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: { categories },
        meta: {
          query,
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      `${categories.length} categories found`
    ).send(res);
  }),

  filterCategory: asyncHandler(async (req, res) => {
    const {
      restaurant,
      isFeatured,
      isPopular,
      isActive,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;
    const filter = {};

    if (restaurant) filter.restaurant = restaurant;
    if (isFeatured) filter.isFeatured = isFeatured === "true";
    if (isPopular) filter.isPopular = isPopular === "true";
    if (isActive) filter.isActive = isActive === "true";

    const [categories, total] = await Promise.all([
      MenuCategory.find(filter)
        .skip(skip)
        .limit(limit)
        .select("name image isFeatured isPopular isActive")
        .populate("restaurant", "name"),

      MenuCategory.countDocuments(filter),
    ]);

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: { categories },
        meta: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit),
          filters:
            Object.keys(filter).length > 0 ? filter : "No filters applied",
        },
      },
      `${categories.length} categories found`
    ).send(res);
  }),

  timeAvailabilityCategory: asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Get current time
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHours * 60 + currentMinutes;

    // Get current day
    const currentDay = now
      .toLocaleString("en-us", { weekday: "short" })
      .toLowerCase();

    const [categories, total] = await Promise.all([
      MenuCategory.find({
        isActive: true,
        daysAvailable: currentDay,
        $or: [
          { isTimeRestricted: false },
          {
            isTimeRestricted: true,
            $expr: {
              $and: [
                {
                  $lte: [
                    {
                      $add: [
                        {
                          $multiply: [
                            {
                              $toInt: {
                                $arrayElemAt: [
                                  { $split: ["$availableTimes.start", ":"] },
                                  0,
                                ],
                              },
                            },
                            60,
                          ],
                        },
                        {
                          $toInt: {
                            $arrayElemAt: [
                              { $split: ["$availableTimes.start", ":"] },
                              1,
                            ],
                          },
                        },
                      ],
                    },
                    currentTime,
                  ],
                },
                {
                  $gte: [
                    {
                      $add: [
                        {
                          $multiply: [
                            {
                              $toInt: {
                                $arrayElemAt: [
                                  { $split: ["$availableTimes.end", ":"] },
                                  0,
                                ],
                              },
                            },
                            60,
                          ],
                        },
                        {
                          $toInt: {
                            $arrayElemAt: [
                              { $split: ["$availableTimes.end", ":"] },
                              1,
                            ],
                          },
                        },
                      ],
                    },
                    currentTime,
                  ],
                },
              ],
            },
          },
        ],
      })
        .skip(skip)
        .limit(limit)
        .select("name availableTimes isTimeRestricted daysAvailable"),

      MenuCategory.countDocuments({
        isActive: true,
        daysAvailable: currentDay,
        $or: [
          { isTimeRestricted: false },
          {
            isTimeRestricted: true,
            $expr: {
              $and: [
                {
                  $lte: [
                    {
                      $add: [
                        {
                          $multiply: [
                            {
                              $toInt: {
                                $arrayElemAt: [
                                  { $split: ["$availableTimes.start", ":"] },
                                  0,
                                ],
                              },
                            },
                            60,
                          ],
                        },
                        {
                          $toInt: {
                            $arrayElemAt: [
                              { $split: ["$availableTimes.start", ":"] },
                              1,
                            ],
                          },
                        },
                      ],
                    },
                    currentTime,
                  ],
                },
                {
                  $gte: [
                    {
                      $add: [
                        {
                          $multiply: [
                            {
                              $toInt: {
                                $arrayElemAt: [
                                  { $split: ["$availableTimes.end", ":"] },
                                  0,
                                ],
                              },
                            },
                            60,
                          ],
                        },
                        {
                          $toInt: {
                            $arrayElemAt: [
                              { $split: ["$availableTimes.end", ":"] },
                              1,
                            ],
                          },
                        },
                      ],
                    },
                    currentTime,
                  ],
                },
              ],
            },
          },
        ],
      }),
    ]);

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: {
          categories,
          currentTime: `${currentHours}:${currentMinutes}`,
          currentDay,
        },
        meta: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      `${categories.length} currently available categories`
    ).send(res);
  }),

  dayAvailablityCategory: asyncHandler(async (req, res) => {
    const { day } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const dayParam = day.trim().toLowerCase();

    if (!validDays.includes(dayParam)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid day. Valid days are: ${validDays.join(", ")}`
      );
    }

    const [categories, total] = await Promise.all([
      MenuCategory.find({
        isActive: true,
        daysAvailable: dayParam,
      })
        .skip(skip)
        .limit(limit)
        .select("name daysAvailable isTimeRestricted availableTimes"),

      MenuCategory.countDocuments({
        isActive: true,
        daysAvailable: dayParam,
      }),
    ]);

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: { categories },
        meta: {
          day: dayParam,
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      `${categories.length} categories available on ${dayParam}`
    ).send(res);
  }),

  colorCategory: asyncHandler(async (req, res) => {
    const { color } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!/^#([0-9A-F]{3}){1,2}$/i.test(color)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid color format. Use hex format (e.g. #FF0000)"
      );
    }

    const [categories, total] = await Promise.all([
      MenuCategory.find({
        colorCode: color.toUpperCase(),
      })
        .skip(skip)
        .limit(limit)
        .select("name colorCode image"),

      MenuCategory.countDocuments({
        colorCode: color.toUpperCase(),
      }),
    ]);

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: { categories },
        meta: {
          color,
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      `${categories.length} categories with color ${color}`
    ).send(res);
  }),

  // Bulk Operations
  createBulkCategory: asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const files = req.files;
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Categories must be an array"
      );
    }

    const categoriesWithImages = await Promise.all(
      categories.map(async (category, index) => {
        // Corrected file key pattern
        const fileKey = `categories[${index}]image`;
        const file = files[fileKey]?.[0];

        if (!file) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            `Missing image for category ${index}`
          );
        }

        const uploadedImage = await uploadFileToCloudinary(file.path);

        if (!uploadedImage) {
          throw new ApiError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "Failed to upload image"
          );
        }

        return {
          ...category,
          name: category.name.trim(),
          slug: category.slug || generateSlug(category.name),
          restaurant: restaurantId,
          createdBy: req.user._id,
          lastUpdatedBy: req.user._id,
          image: {
            url: uploadedImage.secure_url,
            thumbnailUrl: uploadedImage.secure_url,
            altText: uploadedImage.display_name,
          },
        };
      })
    );

    const createdCategories = await MenuCategory.insertMany(
      categoriesWithImages
    );

    return new ApiResponse(
      StatusCodes.CREATED,
      createdCategories,
      "Categories created successfully"
    ).send(res);
  }),

  updateBulkCategory: asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const files = req.files;
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Categories must be an array"
      );
    }

    const bulkOperations = await Promise.all(
      categories.map(async (category, index) => {
        const { _id, name, slug, ...updateData } = category;

        if (!_id) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            "Category ID is required"
          );
        }

        // Handle image update
        const fileKey = `categories[${index}][image]`;
        const file = files?.[fileKey]?.[0];
        let imageUpdate = {};

        if (file) {
          const uploadedImage = await uploadFileToCloudinary(file.path);
          if (!uploadedImage) {
            throw new ApiError(
              StatusCodes.INTERNAL_SERVER_ERROR,
              "Failed to upload image"
            );
          }
          imageUpdate = {
            "image.url": uploadedImage.secure_url,
            "image.thumbnailUrl": uploadedImage.secure_url,
            "image.altText": uploadedImage.display_name,
          };
        }

        // Handle name/slug updates
        const nameUpdate = {};
        if (name) {
          nameUpdate.name = name.trim();
          nameUpdate.slug = slug || generateSlug(name);
        }

        return {
          updateOne: {
            filter: {
              _id: _id,
              restaurant: restaurantId,
            },
            update: {
              $set: {
                ...updateData,
                ...nameUpdate,
                ...imageUpdate,
                lastUpdatedBy: req.user._id,
              },
            },
          },
        };
      })
    );

    const result = await MenuCategory.bulkWrite(bulkOperations);

    if (!result.modifiedCount) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No categories were updated");
    }

    const updatedCategories = await MenuCategory.find({
      restaurant: restaurantId,
    });

    return new ApiResponse(
      StatusCodes.OK,
      updatedCategories,
      "Categories updated successfully"
    ).send(res);
  }),

  deleteBulkCategory: asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const { categoryIds } = req.body;

    if (!categoryIds || !Array.isArray(categoryIds)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Category IDs array is required"
      );
    }

    const result = await MenuCategory.deleteMany({
      _id: { $in: categoryIds },
      restaurant: restaurantId,
    });

    if (result.deletedCount === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "No categories were deleted");
    }

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: {
          result,
        },
      },
      "Categories updated successfully"
    ).send(res);
  }),

  // SEO & Metadata
  createMetaCategory: asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { seoTitle, seoDescription, keywords } = req.body;

    if ([seoTitle, seoDescription, keywords].some((field) => !field)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "seoTitle, seoDescription and keywords are required"
      );
    }

    const category = await MenuCategory.findByIdAndUpdate(
      categoryId,
      {
        metadata: {
          seoTitle,
          seoDescription,
          keywords,
        },
        lastUpdatedBy: req.user._id,
      },
      {
        new: true,
      }
    );

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.CREATED,
      {
        data: {
          category,
        },
      },
      "Category metadata created successfully"
    ).send(res);
  }),

  updateMetaCategory: asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { seoTitle, seoDescription } = req.body;

    if ([seoTitle, seoDescription].some((field) => !field)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "seoTitle, seoDescription  are required"
      );
    }

    const updateFields = {
      lastUpdatedBy: req.user._id,
    };

    if (seoTitle) updateFields["metadata.seoTitle"] = seoTitle;
    if (seoDescription)
      updateFields["metadata.seoDescription"] = seoDescription;

    const category = await MenuCategory.findByIdAndUpdate(
      categoryId,
      { $set: updateFields },
      { new: true }
    );

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: {
          category,
        },
      },
      "Category metadata created successfully"
    ).send(res);
  }),

  updateMetaKeywordCategory: asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { operation, keywords } = req.body;

    if (!["add", "remove", "replace"].includes(operation)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Operation must be 'add', 'remove', or 'replace'"
      );
    }

    let update;

    switch (operation) {
      case "add":
        update = { $addToSet: { "metadata.keywords": { $each: keywords } } };
        break;
      case "remove":
        update = { $pull: { "metadata.keywords": { $in: keywords } } };
        break;
      case "replace":
        update = { $set: { "metadata.keywords": keywords } };
        break;
    }

    const category = await MenuCategory.findByIdAndUpdate(
      categoryId,
      {
        ...update,
        lastUpdatedBy: req.user._id,
      },
      { new: true }
    );

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return new ApiResponse(
      StatusCodes.OK,
      {
        data: {
          category,
        },
      },
      `Keywords ${operation}ed successfully`
    ).send(res);
  }),
};

export default MenuCategoryController;
