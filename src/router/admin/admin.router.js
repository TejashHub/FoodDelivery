/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import {
  promoteToAdmin,
  deleteUser,
  getAllUsers,
  updateUser,
  getUser,
} from "../controllers/admin.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.route("/users").get(getAllUsers);
router.route("/users/:id").get(getUser).patch(updateUser).delete(deleteUser);
router.route("/users/:id/promote").get(promoteToAdmin);

export default router;
