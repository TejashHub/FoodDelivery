/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  deleteAccount,
} from "../controllers/users.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";
import validation from "../middleware/validation.middleware.js";
import {
  updateProfileScheme,
  updateAvatarSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from "../validations/user.validation.js";

const router = express.Router();

// Protected routes
router.use(authMiddleware);

router
  .route("/profile")
  .get(getProfile)
  .patch(validation(updateProfileScheme), updateProfile);
router
  .route("/avatar")
  .patch(upload.single("avatar"), validation(updateAvatarSchema), updateAvatar);
router
  .route("/change-password")
  .patch(validation(changePasswordSchema), changePassword);
router
  .route("/delete-account")
  .delete(validation(deleteAccountSchema), deleteAccount);

export default router;
