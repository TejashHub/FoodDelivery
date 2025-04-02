/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import {
  promoteToAdmin,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  getAdminDetails,
  updateAdminDetails,
} from "../../controller/admin/admin.controller.js";
import { authMiddleware, authorize } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Admin Protected Routes
router.use(authMiddleware);
router.use(authorize("admin"));

// User management
router.route("/users").get(getAllUsers);
router.route("/users/:id").get(getUser).patch(updateUser).delete(deleteUser);
router.route("/users/:id/promote").get(promoteToAdmin);

// Admin management
router.post("/promote/:id", promoteToAdmin);
router.get("/me", getAdminDetails);
router.patch("/me", updateAdminDetails);

export default router;
