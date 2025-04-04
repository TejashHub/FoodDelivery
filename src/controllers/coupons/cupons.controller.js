import Coupon from "../../models/coupon.model.js";
import asynHandler from "../../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";

export const CouponController = {
  createCoupon: async (req, res) => {
    const { code } = req.body;
    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Coupon code already exists");
    }
    const coupon = new Coupon(req.body);
    await coupon.save();
    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Cupon code created succesfully",
      data: {
        coupon,
      },
    });
  },

  getAllCoupons: async (req, res) => {
    const { isActive } = req.query;
    const filter = isActive ? { isActive: isActive === "true" } : {};
    const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
    res.status(StatusCodes.OK).json({
      success: true,
      data: coupons,
    });
  },

  getCouponById: async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Coupon not found");
    }
    res.status(StatusCodes.OK).json({
      success: true,
      data: coupon,
    });
  },

  updateCoupon: async (req, res) => {
    const allowedUpdates = [
      "discountType",
      "discountValue",
      "validUntil",
      "maxUses",
      "minOrderValue",
      "applicableRestaurants",
      "isActive",
    ];
    const updates = Object.keys(req.body);
    const isValidUpdate = updates.every((update) =>
      allowedUpdates.includes(update)
    );
    if (!isValidUpdate) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid update fields");
    }
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!coupon) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Coupon not found");
    }
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon,
    });
  },

  deleteCoupon: async (req, res) => {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Coupon not found");
    }
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  },

  applyCoupon: async (req, res) => {
    const { code, userId, restaurantId, orderValue } = req.body;
    const coupon = await Coupon.findOne({ code, isActive: true });
    if (!coupon) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Invalid coupon code");
    }
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Coupon not valid at this time"
      );
    }
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Coupon not valid at this time"
      );
    }
    if (
      coupon.applicableRestaurants.length > 0 &&
      !coupon.applicableRestaurants.includes(restaurantId)
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Coupon not valid for this restaurant"
      );
    }
    if (coupon.usedBy.includes(userId)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Coupon already used by this user"
      );
    }
    if (orderValue < coupon.minOrderValue) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Minimum order value of ${coupon.minOrderValue} required`
      );
    }
    const discount =
      coupon.discountType === "percentage"
        ? (orderValue * coupon.discountValue) / 100
        : coupon.discountValue;
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        valid: true,
        discount,
        finalAmount: orderValue - discount,
        coupon: coupon.code,
      },
    });
  },

  validateCoupon: async (req, res) => {
    const { code } = req.query;
    const coupon = await Coupon.findOne({ code });

    if (!coupon) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: { valid: false },
      });
    }

    const valid =
      coupon.isActive &&
      new Date() >= coupon.validFrom &&
      new Date() <= coupon.validUntil;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        valid,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
      },
    });
  },

  getCouponsByRestaurant: async (req, res) => {
    const coupons = await Coupon.find({
      applicableRestaurants: req.params.restaurantId,
      isActive: true,
    });
    res.status(StatusCodes.OK).json({
      success: true,
      data: coupons,
    });
  },

  getCouponsByUser: async (req, res) => {
    const coupons = await Coupon.find({
      usedBy: req.params.userId,
    });
    res.status(StatusCodes.OK).json({
      success: true,
      data: coupons,
    });
  },

  toggleCouponStatus: async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Coupon not found");
    }
    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"}`,
      data: { isActive: coupon.isActive },
    });
  },

  getRemainingUses: async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Coupon not found");
    }
    const remaining = coupon.maxUses
      ? coupon.maxUses - coupon.usedBy.length
      : "Unlimited";
    res.status(StatusCodes.OK).json({
      success: true,
      data: { remaining },
    });
  },
};
