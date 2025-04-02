import express from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} from "../../controller/users/users.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
const router = express.Router();

// Protected routes
router.use(authMiddleware);

router.route("/profile").get(getProfile).patch(updateProfile);
router.route("/change-password").patch(changePassword);
router.route("/delete-account").delete(deleteAccount);

export default router;
