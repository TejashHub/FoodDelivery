/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 * @description User profile management routes
 */

import express from "express";

// Controller imports
import {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  deleteAccount,
} from "../controllers/users.controller.js";

// Security middleware
import { authMiddleware } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";
import validation from "../middleware/validation.middleware.js";

// Validation schemas
import {
  avatarSchema,
  passwordSchema,
  updateProfileScheme,
  changePasswordSchema,
} from "../validations/user.validation.js";

const router = express.Router();

// --------------------------
// Protected Routes (Require authentication)
// --------------------------

router.use(authMiddleware);

// Profile management
router
  .route("/profile")
  .get(getProfile)
  .patch(validation(updateProfileScheme), updateProfile);

// Avatar operations
router
  .route("/avatar")
  .patch(upload.single("avatar"), validation(avatarSchema), updateAvatar);

// Security-sensitive operations
router
  .route("/change-password")
  .patch(validation(changePasswordSchema), changePassword);

router
  .route("/delete-account")
  .delete(validation(passwordSchema), deleteAccount);

export default router;
