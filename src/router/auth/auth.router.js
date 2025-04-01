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
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  authLimiter,
  passwordResetLimiter,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Public Route
router.route("/login").post(authLimiter, login);
router.route("/register").post(upload.single("avatar"), register);
router.route("/refresh-token").get(refreshAccessToken);
router.route("/forgot-password").post(passwordResetLimiter, forgotPassword);
router.route("/reset-password").post(verifyEmail);
router.route("/verify-email").post(passwordResetLimiter, resetPassword);
router.route("/resend-verification").post(resendVerification);

// Private Route
router.route("/").post(authMiddleware, logout);
router
  .route("/me")
  .post(authMiddleware, getProfile)
  .patch(authMiddleware, upload.single("avatar"), updateProfile)
  .delete(authMiddleware, deleteAccount);
router.route("/me/change-password").post(authMiddleware, changePassword);

export default router;
