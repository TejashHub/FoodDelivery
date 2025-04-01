/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";

import adminRouter from "./admin/admin.router.js";
import authRouter from "./auth/auth.router.js";

const router = express.Router();

router.use("/admin", adminRouter);

router.use("/auth", authRouter);

export default router;
