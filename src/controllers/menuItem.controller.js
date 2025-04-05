import MenuItem from "../../models/menuItem.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../../errors/ApiError.js";

export const MenuItemController = {
  // Core CRUD
  createMenuItem: asyncHandler(async (req, res) => {
    const { itemId, restaurantId, categoryId } = req.body;

    const existingItem = await MenuItem.findOne({ itemId });
    if (existingItem) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Item ID must be unique");
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid restaurant ID");
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category ID");
    }

    const menuItem = await MenuItem.create(req.body);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Menu item created successfully",
      data: menuItem,
    });
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
    } = req.query;

    const filter = {};

    if (restaurantId) filter.restaurantId = restaurantId;
    if (categoryId) filter.categoryId = categoryId;
    if (isVeg) filter.isVeg = isVeg === "true";
    if (isAvailable) filter.isAvailable = isAvailable === "true";
    if (dietaryTags) filter.dietaryTags = { $in: dietaryTags.split(",") };

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
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

    res.status(StatusCodes.OK).json({
      success: true,
      data: menuItems,
    });
  }),

  getMenuItemById: asyncHandler(async (req, res) => {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate("restaurantId", "name address")
      .populate("categoryId", "name");

    if (!menuItem) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Menu item not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: menuItem,
    });
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
