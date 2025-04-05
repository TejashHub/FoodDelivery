import { authRoles, authMiddleware } from "../../middleware/auth.middleware.js";
import express from "express";
import { CartControllers } from "../../controllers/carts/carts.controller.js";

const router = express.Router();

router.route("/").post(authMiddleware, CartControllers.createCarts);
router.route("/my-cart").get(authMiddleware, CartControllers.getCarts);
router.route("/:id").delete(authMiddleware, CartControllers.deleteCarts);
router.route("/items").post(authMiddleware, CartControllers.addToCartItems);
router
  .route("/items/:itemId")
  .patch(authMiddleware, CartControllers.updateToCartItems)
  .delete(authMiddleware, CartControllers.deleteToCartItems);
router
  .route("/items/bulk")
  .post(authMiddleware, CartControllers.addMultipleCartItem);
router.route("/apply-coupon").patch(authMiddleware, CartControllers.applyCupon);
router
  .route("/remove-coupon")
  .delete(authMiddleware, CartControllers.removeCupon);
router
  .route("/calculate-totals")
  .get(authMiddleware, CartControllers.cartCalculation);
router.route("/transfer").post(authMiddleware, CartControllers.cartTransfer);
router
  .route("/")
  .get(authRoles("admin"), authMiddleware, CartControllers.getAllAdminCart);
router
  .route("/:userId")
  .get(authRoles("admin"), authMiddleware, CartControllers.getAdminCart);
export default router;
