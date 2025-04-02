/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";

import authRoutes from "./auth/auth.router.js";
import userRoutes from "./users/users.router.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);

export default router;
