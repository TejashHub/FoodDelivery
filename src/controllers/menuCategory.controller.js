import mongoose from "mongoose";
import Restaurant from "../../models/restaurant.model.js";
import MenuCategory from "../../models/menuCategory.model.js";
import MenuItem from "../../models/menuItem.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import {
  cloudinaryFileUpload,
  cloudinaryFileRemove,
} from "../../utils/cloudinary.js";

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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Categories retrieved successfully",
      data: { categories },
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Category retrieved successfully",
      data: { category },
    });
  }),

  createMenuCategoryController: asyncHandler(async (req, res) => {
    const { name, restaurant } = req.body;

    if (!name || !restaurant) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Name and restaurant are required"
      );
    }

    const restaurantExit = await Restaurant.findById(restaurant);

    if (!restaurantExit) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Restaurant not found.");
    }

    const existCategory = await MenuCategory.findOne({
      name,
      restaurant,
    });

    if (existCategory) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Category already exists for this restaurant."
      );
    }

    const category = await MenuCategory.create({
      ...req.body,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
    });

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Category created successfully",
      data: { category },
    });
  }),

  updateMenuCategoryController: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category ID");
    }

    if (updateData.restaurant) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Cannot change category restaurant"
      );
    }

    const category = await MenuCategory.findByIdAndUpdate(
      {
        id,
        ...updateData,
        lastUpdatedBy: req.user._id,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Category updated successfully",
      data: { category },
    });
  }),

  deleteMenuCategoryController: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category ID");
    }

    const categoryWithItems = await MenuCategory.findById(id).select("items");

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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Category deleted successfully",
      data: { category },
    });
  }),

  // Availability Management
  availabilityCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== Boolean) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "isActive must be a boolean");
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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `Category ${
        isActive ? "activated" : "deactivated"
      } successfully`,
      data: { category },
    });
  }),

  availableTimesCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { start, end, isTimeRestricted } = req.body;

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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Category availability times updated",
      data: {
        availableTimes: category.availableTimes,
        isTimeRestricted: category.isTimeRestricted,
      },
    });
  }),

  availableTimesCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { daysAvailable } = req.body;

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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Category available days updated",
      data: { daysAvailable: category.daysAvailable },
    });
  }),

  checkAvailabilityCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await MenuCategory.findById(id);

    if (!category) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
    }

    const isAvailable = category.isCurrentlyAvailable();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: isAvailable
        ? "Category is currently available"
        : "Category is not available",
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
    });
  }),

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

  // Display & Ordering
  displayOrderCategory: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { displayOrder } = req.body;

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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Display order updated",
      data: {
        category: {
          name: category.name,
          newOrder: category.displayOrder,
          restaurant: category.restaurant,
        },
      },
    });
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

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Featured order updated",
      data: {
        category: {
          name: category.name,
          isFeatured: category.isFeatured,
          featuredOrder: category.featuredOrder,
        },
      },
    });
  }),

  sortedCategory: asyncHandler(async (req, res) => {
    const { sortBy = "displayOrder", sortDirection = "asc" } = req.query;

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

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Categories sorted by ${sortBy} (${sortDirection})`,
      data: { categories },
      meta: {
        sortBy,
        sortDirection,
        count: categories.length,
      },
    });
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

      res.status(StatusCodes.OK).json({
        success: true,
        message: `${newOrder.length} categories reordered`,
        data: {
          updatedCount: result.modifiedCount,
        },
      });
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
        await cloudinaryFileUpload(imagePath),
        await cloudinaryFileUpload(thumbnailPath),
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
          cloudinaryFileRemove(imageResult.public_id),
          cloudinaryFileRemove(thumbnailResult.public_id),
        ]);
        throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
      }

      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Image uploaded successfully",
        data: {
          category: {
            name: category.name,
            image: category.image,
          },
        },
      });
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
        cloudinaryFileUpload(imagePath),
        cloudinaryFileUpload(thumbnailPath),
      ]);

      if (!imageResult || !thumbnailResult) {
        throw new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Image upload failed"
        );
      }

      if (category.image?.url) {
        const oldPublicId = category.image.url.split("/").pop().split(".")[0];
        await cloudinaryFileRemove(oldPublicId);
      }

      if (category.image?.thumbnailUrl) {
        const oldThumbnailPublicId = category.image.thumbnailUrl
          .split("/")
          .pop()
          .split(".")[0];
        await cloudinaryFileRemove(oldThumbnailPublicId);
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

      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Image updated successfully",
        data: {
          category: {
            name: updatedCategory.name,
            image: updatedCategory.image,
          },
        },
      });
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
        cloudinaryFileRemove(publicId),
        thumbnailPublicId && cloudinaryFileRemove(thumbnailPublicId),
      ]);

      const updatedCategory = await MenuCategory.findByIdAndUpdate(
        id,
        {
          $unset: { image: 1 },
          lastUpdatedBy: req.user._id,
        },
        { new: true }
      ).select("name");

      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Image deleted successfully",
        data: {
          category: {
            name: updatedCategory.name,
            image: null,
          },
        },
      });
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

    if (!query || !query.trim().length < 2) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Search query must be at least 2 characters long"
      );
    }

    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(q, "i");

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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `${categories.length} categories found`,
      data: { categories },
      meta: {
        query: q,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `${categories.length} categories found`,
      data: { categories },
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
        filters: Object.keys(filter).length > 0 ? filter : "No filters applied",
      },
    });
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

    res.status(StatusCodes.OK).json({
      success: true,
      message: `${categories.length} currently available categories`,
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
    });
  }),

  dayAvailablityCategory: asyncHandler(async (req, res) => {
    const { day } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

    if (!validDays.includes(day.toLowerCase())) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid day. Valid days are: ${validDays.join(", ")}`
      );
    }

    const [categories, total] = await Promise.all([
      MenuCategory.find({
        isActive: true,
        daysAvailable: day.toLowerCase(),
      })
        .skip(skip)
        .limit(limit)
        .select("name daysAvailable isTimeRestricted availableTimes"),

      MenuCategory.countDocuments({
        isActive: true,
        daysAvailable: day.toLowerCase(),
      }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      message: `${categories.length} categories available on ${day}`,
      data: { categories },
      meta: {
        day,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `${categories.length} categories with color ${color}`,
      data: { categories },
      meta: {
        color,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  // Bulk Operations
  createBulkCategory: asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const { categories } = req.body;

    if (!categories || !Array.isArray(categories)) {
      throw new ApiError(400, "Categories array is required");
    }

    const categoriesWithRestaurant = categories.map((category) => ({
      ...category,
      restaurant: restaurantId,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
    }));

    const createdCategories = await MenuCategory.insertMany(
      categoriesWithRestaurant
    );

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Categories created successfully",
      data: {
        createdCategories,
      },
    });
  }),

  updateBulkCategory: asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Updates array is required");
    }

    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: {
          _id: update._id,
          restaurant: restaurantId,
        },
        update: {
          ...update,
          lastUpdatedBy: req.user._id,
        },
      },
    }));

    const result = await MenuCategory.bulkWrite(bulkOps);

    if (result.modifiedCount === 0) {
      throw new ApiError(404, "No categories were updated");
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Categories updated successfully",
      data: {
        result,
      },
    });
  }),

  deleteBulkCategory: asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const { categoryIds } = req.body;

    if (!categoryIds || !Array.isArray(categoryIds)) {
      throw new ApiError(400, "Category IDs array is required");
    }

    const result = await MenuCategory.deleteMany({
      _id: { $in: categoryIds },
      restaurant: restaurantId,
    });

    if (result.deletedCount === 0) {
      throw new ApiError(404, "No categories were deleted");
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Categories updated successfully",
      data: {
        result,
      },
    });
  }),

  // SEO & Metadata
  createMetaCategory: asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { seoTitle, seoDescription, keywords } = req.body;

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
      throw new ApiError(404, "Category not found");
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Category metadata created successfully",
      data: {
        category,
      },
    });
  }),

  updateMetaCategory: asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { seoTitle, seoDescription } = req.body;

    const category = await MenuCategory.findByIdAndUpdate(
      categoryId,
      {
        $set: {
          "metadata.seoTitle": seoTitle,
          "metadata.seoDescription": seoDescription,
        },
        lastUpdatedBy: req.user._id,
      },
      {
        new: true,
      }
    );

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Category metadata created successfully",
      data: {
        category,
      },
    });
  }),

  updateMetaKeywordCategory: asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { operation, keywords } = req.body;

    if (!["add", "remove", "replace"].includes(operation)) {
      throw new ApiError(
        400,
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
      throw new ApiError(404, "Category not found");
    }

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: `Keywords ${operation}ed successfully`,
      data: {
        category,
      },
    });
  }),
};

export default MenuCategoryController;
