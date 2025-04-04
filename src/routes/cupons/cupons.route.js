import express from "express";
import { CouponController } from "../../controllers/coupons/cupons.controller.js";

const router = express.Router();

router
  .route("/")
  .post(CouponController.createCoupon)
  .get(CouponController.getAllCoupons);
router
  .route("/:id")
  .get(CouponController.getCouponById)
  .patch(CouponController.updateCoupon)
  .delete(CouponController.deleteCoupon);
router.route("/apply").post(CouponController.applyCoupon);
router.route("/validate").get(CouponController.validateCoupon);
router
  .route("/restaurant/:restaurantId")
  .get(CouponController.getCouponsByRestaurant);
router.route("/user/:userId").get(CouponController.getCouponsByUser);
router.route("/:id/toggle-status").patch(CouponController.toggleCouponStatus);
router.route("/:id/remaining-uses").get(CouponController.getRemainingUses);

export default router;
