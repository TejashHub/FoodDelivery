import express from "express";
import {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  deleteAccount,
} from "../../controller/users/users.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import upload from "../../middleware/multer.middleware.js";
const router = express.Router();

// Protected routes
router.use(authMiddleware);

router.route("/profile").get(getProfile).patch(updateProfile);
router.route("/avatar").patch(upload.single("avatar"), updateAvatar);
router.route("/change-password").patch(changePassword);
router.route("/delete-account").delete(deleteAccount);

export default router;
