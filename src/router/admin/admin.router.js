import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  impersonateUser,
  getSystemStats,
} from "../../controller/adminController.js";
import { authMiddleware, authRoles } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Admin dashboard routes
router.use(authMiddleware);
router.use(authRoles("admin", "moderator"));

// User management
router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id/role", authorizeRoles("admin"), updateUserRole);
router.put("/users/:id/status", toggleUserStatus);
router.delete("/users/:id", authorizeRoles("admin"), deleteUser);

// Admin tools
router.post("/impersonate/:id", authorizeRoles("admin"), impersonateUser);
router.get("/stats", getSystemStats);
