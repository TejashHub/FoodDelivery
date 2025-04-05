import Dishes from "../../models/dishes.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import { cloudinaryFileUpload } from "../../utils/cloudinary.js";

const validCategories = ["Appetizer", "Main Course", "Dessert"];

export const DishesController = {
  getAllDishes: asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [dishes, total] = await Promise.all([
      Dishes.find().skip(skip).limit(limit).lean(),
      Dishes.countDocuments(),
    ]);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: dishes.length
        ? "Dishes fetched successfully"
        : "No dishes found",
      data: { dishes },
      pagination: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  searchDishes: asyncHandler(async (req, res) => {
    const { query = "", page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!query.trim()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Search query is required");
    }

    const [dishes, total] = await Promise.all([
      Dishes.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      })
        .skip(skip)
        .limit(limit),
      Dishes.countDocuments({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      }),
    ]);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Search results fetched successfully",
      data: { dishes },
      pagination: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  getDishesByCategory: asyncHandler(async (req, res) => {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!validCategories.includes(category)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category");
    }

    const [dishes, total] = await Promise.all([
      Dishes.find({ category }).skip(skip).limit(limit),
      Dishes.countDocuments({ category }),
    ]);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `Dishes in ${category} fetched successfully`,
      data: { dishes },
      pagination: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  createDish: asyncHandler(async (req, res) => {
    const { name, price, restaurant, category } = req.body;

    if (!name || !price || !restaurant) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Name, price, and restaurant are required"
      );
    }

    if (category && !validCategories.includes(category)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category");
    }

    const dish = await Dishes.create(req.body);

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Dish created successfully",
      data: { dish },
    });
  }),

  updateDish: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { category } = req.body;

    if (category && !validCategories.includes(category)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid category");
    }

    const dish = await Dishes.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!dish) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Dish not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Dish updated successfully",
      data: { dish },
    });
  }),

  toggleAvailability: asyncHandler(async (req, res) => {
    const { id } = req.params;

    const dish = await Dishes.findById(id);
    if (!dish) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Dish not found");
    }

    dish.isAvailable = !dish.isAvailable;
    await dish.save();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `Dish is now ${dish.isAvailable ? "available" : "unavailable"}`,
      data: { dish },
    });
  }),

  uploadImage: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const imageFile = req.file;

    if (!imageFile) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Image file is required");
    }

    const dishExists = await Dishes.exists({ _id: id });
    if (!dishExists) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Dish not found");
    }

    const imageUrl = await cloudinaryFileUpload(imageFile.path);
    if (!imageUrl) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to upload image"
      );
    }

    const dish = await Dishes.findByIdAndUpdate(
      id,
      { imageUrl },
      { new: true }
    );

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Dish image uploaded successfully",
      data: { dish },
    });
  }),
};
