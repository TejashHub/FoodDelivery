/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";

import authRoutes from "./auth/auth.route.js";
import adminRoutes from "./admin/admin.route.js";
import userRoutes from "./users/users.route.js";
import resturantRouter from "./restaurant/restaurant.route.js";
import reviewRouter from "./review/review.route.js";
import dishRouter from "./review/dish.route.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/user", userRoutes);
router.use("/restaurant", resturantRouter);
router.use("/review", reviewRouter);
router.use("/dish", dishRouter);

export default router;
