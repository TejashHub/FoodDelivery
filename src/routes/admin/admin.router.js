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
import {
  authMiddleware,
  authRoles,
} from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Admin dashboard routes
router.use(authMiddleware);
router.use(authRoles("admin", "moderator"));

// User management
router.route("/users").get(getAllUsers);
router.route("/users/:id").get(getUserById);
router.route("/users/:id").delete(authRoles("admin"), deleteUser);
router.route("/users/:id/role").patch(authRoles("admin"), updateUserRole);
router.route("/users/:id/status").patch(toggleUserStatus);

// Admin tools
router.route("/impersonate/:id").get(authRoles("admin"), impersonateUser);
router.route("/stats").get(getSystemStats);

export default router;
