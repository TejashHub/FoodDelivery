/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 * @description User profile management routes
 */

import express from "express";

// Controller
import { userController } from "../controllers/users.controller.js";

// middlewares
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

router
  .route("/profile")
  .get(userController.getProfile)
  .patch(validation(updateProfileScheme), userController.updateProfile);

router
  .route("/avatar")
  .patch(
    upload.single("avatar"),
    validation(avatarSchema),
    userController.updateAvatar
  );

router
  .route("/change-password")
  .patch(validation(changePasswordSchema), userController.changePassword);

router
  .route("/delete-account")
  .delete(validation(passwordSchema), userController.deleteAccount);

export default router;
