import Cart from "../../models/cart.model.js";
import MenuItem from "../../models/menuItem.model.js";
import asyncHandler from "../../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../../errors/ApiError.js";

export const CartControllers = {
  createCarts: asyncHandler(async (req, res) => {
    const { restaurant } = req.body;
    const existingCart = await Cart.findOne({ user: req.user._id });
    if (existingCart) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "User already has a cart");
    }
    const cart = await Cart.create({
      user: req.user._id,
      restaurant,
      items: [],
      total: 0,
      grandTotal: 0,
    });
    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Cart created successfully",
      data: { cart },
    });
  }),

  getCarts: asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate("items.menuItem")
      .populate("restaurant", "name logo")
      .populate("coupon");

    if (!cart) {
      throw new ApiError(StatusCodes.OK, "No cart found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Cart retrieved successfully",
      data: { cart },
    });
  }),

  deleteCarts: asyncHandler(async (req, res) => {
    const cart = await Cart.findOneAndDelete({ user: req.user._id });
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Cart deleted successfully",
      data: { cart },
    });
  }),

  addToCartItems: asyncHandler(async (req, res) => {
    const { menuItem, quantity, specialInstructions, customizations, addons } =
      req.body;

    if (!menuItem || !quantity) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "MenuItem and quantity are required"
      );
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const menuItemDoc = await MenuItem.findById(menuItem);
    const customizationsTotal =
      customizations?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;
    const addonsTotal =
      addons?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;
    const itemTotal =
      (menuItemDoc.price + customizationsTotal + addonsTotal) * quantity;

    cart.items.push({
      menuItem,
      quantity,
      specialInstructions,
      customizations,
      addons,
      itemTotal,
    });

    await cartCalculation(cart);

    await cart.save();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Item added to cart",
      data: { cart },
    });
  }),

  updateToCartItems: asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const updateData = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }

    const itemIndex = cart.items.findIndex((item) => item._id.equals(itemId));
    if (itemIndex === -1) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Item not found in cart");
    }

    if (updateData.quantity)
      cart.items[itemIndex].quantity = updateData.quantity;
    if (updateData.specialInstructions !== undefined) {
      cart.items[itemIndex].specialInstructions =
        updateData.specialInstructions;
    }

    const menuItem = await MenuItem.findById(cart.items[itemIndex].menuItem);
    cart.items[itemIndex].itemTotal =
      menuItem.price * cart.items[itemIndex].quantity;

    await cartCalculation(cart);
    await cart.save();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Cart item updated",
      data: { cart },
    });
  }),

  deleteToCartItems: asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }
    cart.items = cart.items.filter((item) => !item._id.equals(itemId));

    await cartCalculation(cart);
    await cart.save();

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Item removed from cart",
      data: { cart },
    });
  }),

  addMultipleCartItem: asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Items array is required");
    }
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (!menuItem) continue;
      const existingItemIndex = cart.items.findIndex((cartItem) =>
        cartItem.menuItem.equals(item.menuItem)
      );
      if (existingItemIndex >= 0) {
        cart.items[existingItemIndex].quantity += item.quantity || 1;
      } else {
        cart.items.push({
          menuItem: item.menuItem,
          quantity: item.quantity || 1,
          specialInstructions: item.specialInstructions,
          customizations: item.customizations,
          addons: item.addons,
        });
      }
    }
    await cartCalculation(cart);
    await cart.save();
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Multiple items added to cart",
      data: { cart },
    });
  }),

  applyCupon: asyncHandler(async (req, res) => {
    const { couponCode } = req.body;
    const coupon = await Coupon.findOne({ code: couponCode });
    if (!coupon) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Coupon not found");
    }
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }
    if (coupon.expiryDate < new Date()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Coupon has expired");
    }
    cart.coupon = coupon._id;
    await cartCalculation(cart);
    await cart.save();
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Coupon applied successfully",
      data: { cart },
    });
  }),

  removeCupon: asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }
    cart.coupon = null;
    cart.discount = 0;
    await cartCalculation(cart);
    await cart.save();
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Coupon removed successfully",
      data: { cart },
    });
  }),

  cartCalculation: asyncHandler(async (req, res) => {
    cart.total = cart.items.reduce((sum, item) => sum + item.itemTotal, 0);
    if (cart.coupon) {
      const coupon = await Coupon.findById(cart.coupon);
      if (coupon) {
        cart.discount =
          coupon.discountType === "percentage"
            ? (cart.total * coupon.discountValue) / 100
            : coupon.discountValue;
      }
    }
    cart.grandTotal = cart.total - cart.discount;
    cart.lastUpdated = new Date();
  }),

  cartTransfer: asyncHandler(async (req, res) => {
    const { cartId, newUserId } = req.body;
    if (req.user.role !== "admin") {
      throw new ApiError(StatusCodes.FORBIDDEN, "Admin access required");
    }
    const cart = await Cart.findByIdAndUpdate(
      cartId,
      { user: newUserId },
      { new: true }
    );

    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Cart transferred successfully",
      data: { cart },
    });
  }),

  getAllAdminCart: asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      throw new ApiError(StatusCodes.FORBIDDEN, "Admin access required");
    }
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const carts = await Cart.find()
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .populate("restaurant", "name");
    const total = await Cart.countDocuments();
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "All carts retrieved",
      data: { carts },
      meta: { page, limit, total },
    });
  }),

  getAdminCart: asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      throw new ApiError(StatusCodes.FORBIDDEN, "Admin access required");
    }
    const { id } = req.params;
    const cart = await Cart.findById(id)
      .populate("user", "name email phone")
      .populate("items.menuItem")
      .populate("coupon");
    if (!cart) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Cart not found");
    }
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Cart details retrieved",
      data: { cart },
    });
  }),
};
