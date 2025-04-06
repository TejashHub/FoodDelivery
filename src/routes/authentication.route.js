/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 * @description Authentication routes for user management
 */

import express from "express";

// Controller
import { authenticationController } from "../controllers/authentication.controller.js";

// Middlewares
import { authMiddleware } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";
import validation from "../middleware/validation.middleware.js";
import {
  authLimiter,
  passwordResetLimiter,
} from "../middleware/rateLimiter.middleware.js";

// Validation Schemas
import {
  emailSchema,
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  resetPasswordSchema,
} from "../validations/user.validation.js";

const router = express.Router();

// --------------------------
// Public Routes (No auth required)
// --------------------------

router
  .route("/login")
  .post(authLimiter, validation(loginSchema), authenticationController.login);

router
  .route("/register")
  .post(
    authLimiter,
    upload.single("avatar"),
    validation(registerSchema),
    register
  );

router
  .route("/verify-email")
  .post(validation(verifyEmailSchema), authenticationController.verifyEmail);

router
  .route("/forgot-password")
  .post(
    passwordResetLimiter,
    validation(emailSchema),
    authenticationController.forgotPassword
  );
router
  .route("/reset-password")
  .post(
    passwordResetLimiter,
    validation(resetPasswordSchema),
    authenticationController.resetPassword
  );

router
  .route("/resend-verification")
  .post(validation(emailSchema), authenticationController.resendVerification);

// --------------------------
// Protected Routes (Require authentication)
// --------------------------

router.use(authMiddleware);

router.route("/logout").post(authenticationController.logout);
router.route("/refresh-token").get(authenticationController.refreshAccessToken);

export default router;
