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
} from "../../controllers/auth/auth.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import upload from "../../middleware/multer.middleware.js";
import validation from "../../middleware/validation.middleware.js";
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetEmailVerificationSchema,
} from "../../validations/user.validation.js";
import {
  authLimiter,
  passwordResetLimiter,
} from "../../middleware/rateLimiter.middleware.js";

const router = express.Router();

// Public Routes
router.route("/login").post(authLimiter, validation(loginSchema), login);

router
  .route("/register")
  .post(
    authLimiter,
    upload.single("avatar"),
    validation(registerSchema),
    register
  );

router.route("/verify-email").post(validation(verifyEmailSchema), verifyEmail);

router
  .route("/forgot-password")
  .post(passwordResetLimiter, validation(forgotPasswordSchema), forgotPassword);

router
  .route("/reset-password")
  .post(passwordResetLimiter, validation(resetPasswordSchema), resetPassword);

router
  .route("/resend-verification")
  .post(validation(resetEmailVerificationSchema), resendVerification);

// Protected Routes
router.route("/logout").post(authMiddleware, logout);

router.route("/refresh-token").get(authMiddleware, refreshAccessToken);

export default router;
