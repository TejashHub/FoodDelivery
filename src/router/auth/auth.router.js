/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import {
  register,
  login,
  logout,
  refreshAccessToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  authLimiter,
  passwordResetLimiter,
} from "../../controller/auth/auth.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import upload from "../../middleware/multer.middleware.js";

const router = express.Router();

// Public Route
router.route("/login").post(authLimiter, login);
router.route("/register").post(authLimiter, upload.single("avatar"), register);
router.route("/verify-email").post(verifyEmail);
router.route("/forgot-password").post(passwordResetLimiter, forgotPassword);
router.route("/reset-password").post(passwordResetLimiter, resetPassword);
router.route("/resend-verification").post(resendVerification);

// Private Route
router.route("/logout").post(authMiddleware, logout);
router.route("/refresh-token").get(authMiddleware, refreshAccessToken);

export default router;
