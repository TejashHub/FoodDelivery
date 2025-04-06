/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";

import authRoutes from "./authentication.route.js";
import adminRoutes from "./admin.route.js";
import userRoutes from "./users.route.js";
// import resturantRouter from "./restaurant/restaurant.route.js";
// import reviewRouter from "./review/review.route.js";
// import dishRouter from "./dishes/dishes.route.js";
// import addressRouter from "./address/address.route.js";
// import cartsRouter from "./carts/carts.route.js";
// import menuCategoryRoute from "./menuCategory/menuCategory.route.js";
// import couponRouter from "./cupons/cupons.route.js";
// import menuItemRouter from "./menuItem/menuItem.route.js";
// import deliveryAgentRouter from "./deliveryAgent/deliveryAgent.route.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/user", userRoutes);
// router.use("/restaurant", resturantRouter);
// router.use("/review", reviewRouter);
// router.use("/dish", dishRouter);
// router.use("/address", addressRouter);
// router.use("/carts", cartsRouter);
// router.use("/categories", menuCategoryRoute);
// router.use("/cupon", couponRouter);
// router.use("/menu-items", menuItemRouter);
// router.use("/delivery-agents", deliveryAgentRouter);

export default router;
