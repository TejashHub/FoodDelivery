import Review from "../../models/Review.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../errors/ApiError.js";
import mongoose from "mongoose";

export const ReviewController = {
  createReview: asyncHandler(async (req, res) => {
    const { restaurant, rating, comment } = req.body;

    if ([restaurant, rating, comment].some((field) => !field)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Restaurant, Rating, and Comment are required"
      );
    }

    if (rating < 1 || rating > 5) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Rating must be between 1 and 5"
      );
    }

    const existReview = await Review.findOne({
      user: req.user._id,
      restaurant,
    });

    if (existReview) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "You have already reviewed this restaurant"
      );
    }

    const review = await Review.create({
      user: req.user._id,
      restaurant,
      rating,
      comment,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Review created successfully",
      data: { review },
    });
  }),

  getAllReview: asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.restaurant) filter.restaurant = req.query.restaurant;
    if (req.query.user) filter.user = req.query.user;

    if (req.query.rating) {
      if (req.query.rating.gte) {
        filter.rating = { $gte: Number(req.query.rating.gte) };
      }
      if (req.query.rating.lte) {
        filter.rating = {
          ...filter.rating,
          $lte: Number(req.query.rating.lte),
        };
      }
    }

    const sort = req.query.sort || "-createdAt";

    const reviews = await Review.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .populate("restaurant", "name address");

    const total = await Review.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      message:
        reviews.length > 0
          ? "Reviews fetched successfully"
          : "No reviews found",
      data: {
        reviews,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  getReview: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid review ID format");
    }

    const review = await Review.findById(id)
      .populate("user", "name email avatar")
      .populate("restaurant", "name address cuisine");

    if (!review) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Review fetched successfully",
      data: { review },
    });
  }),

  updateReview: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid review ID format");
    }

    const existReview = await Review.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!existReview) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Review not found or unauthorized"
      );
    }

    if (rating && (rating < 1 || rating > 5)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Rating must be 1-5");
    }

    const updateData = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment;

    const updatedReview = await Review.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("user", "name email")
      .populate("restaurant", "name");

    if (!updatedReview) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Review not found");
    }
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Review updated successfully",
      data: { review: updatedReview },
    });
  }),

  deleteReview: asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid review ID format");
    }

    const review = await Review.findOneAndDelete({
      _id: id,
      user: req.user._id, // Ensure only owner can delete
    });

    if (!review) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Review not found or unauthorized"
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Review deleted successfully",
    });
  }),

  deleteManyReview: asyncHandler(async (req, res) => {
    const filter = req.body.filter || {};

    const result = await Review.deleteMany(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      message: `${result.deletedCount} reviews deleted successfully`,
      data: { deletedCount: result.deletedCount },
    });
  }),

  getReviewByRestaurant: asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Invalid restaurant ID format"
      );
    }

    const reviews = await Review.find({ restaurant: restaurantId })
      .populate("user", "name email")
      .populate("restaurant", "name address");

    if (reviews.length === 0) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "No reviews found for this restaurant"
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Reviews for the restaurant fetched successfully",
      data: { reviews },
    });
  }),

  getReviewByUser: asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid user ID format");
    }

    const reviews = await Review.find({ user: userId })
      .populate("user", "name email")
      .populate("restaurant", "name address");

    if (reviews.length === 0) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "No reviews found for this user"
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Reviews for the user fetched successfully",
      data: { reviews },
    });
  }),
};
