/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  impersonateUser,
  getSystemStats,
} from "../../controllers/admin/admin.controller.js";
import { authMiddleware, authRoles } from "../../middleware/auth.middleware.js";
import validation from "../../middleware/validation.middleware.js";
import {
  getAllUsersSchema,
  updateUserRoleSchema,
  toggleUserStatusSchema,
  impersonateUserSchema,
  userProfileSchema,
} from "../../validations/user.validation.js";

const router = express.Router();

// Admin dashboard routes
router.use(authMiddleware);
router.use(authRoles("admin", "moderator"));

// User management
router.route("/users").get(validation(getAllUsersSchema), getAllUsers);
router.route("/users/:id").get(getUserById);
router.route("/users/:id").delete(authRoles("admin"), deleteUser);
router
  .route("/users/:id/role")
  .patch(authRoles("admin"), validation(updateUserRoleSchema), updateUserRole);
router
  .route("/users/:id/status")
  .patch(validation(toggleUserStatusSchema), toggleUserStatus);

// Admin tools
router
  .route("/impersonate/:id")
  .get(authRoles("admin"), validation(impersonateUserSchema), impersonateUser);
router.route("/stats").get(validation(userProfileSchema), getSystemStats);

export default router;
