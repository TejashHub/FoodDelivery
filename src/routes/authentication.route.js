/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 * @description Authentication routes for user management
 */

import express from "express";

// Core dependencies
import {
  register,
  login,
  logout,
  refreshAccessToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from "../controllers/authentication.controller.js";

// Security middleware
import { authMiddleware } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";
import validation from "../middleware/validation.middleware.js";
import {
  authLimiter,
  passwordResetLimiter,
} from "../middleware/rateLimiter.middleware.js";

// Request validation schemas
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetEmailVerificationSchema,
} from "../validations/user.validation.js";

const router = express.Router();

// --------------------------
// Public Routes (No auth required)
// --------------------------

// User authentication
router.route("/login").post(authLimiter, validation(loginSchema), login);

// User registration with avatar upload
router
  .route("/register")
  .post(
    authLimiter,
    upload.single("avatar"),
    validation(registerSchema),
    register
  );

// Email verification flow
router.route("/verify-email").post(validation(verifyEmailSchema), verifyEmail);

// Password recovery system
router
  .route("/forgot-password")
  .post(passwordResetLimiter, validation(forgotPasswordSchema), forgotPassword);
router
  .route("/reset-password")
  .post(passwordResetLimiter, validation(resetPasswordSchema), resetPassword);

// Verification retry
router
  .route("/resend-verification")
  .post(validation(resetEmailVerificationSchema), resendVerification);

// --------------------------
// Protected Routes
// --------------------------

router.use(authMiddleware);

router.route("/logout").post(logout);
router.route("/refresh-token").get(refreshAccessToken);

export default router;
