import express from "express";

// Controller
import { adminController } from "../controllers/admin.controller.js";

// Middleware
import { authMiddleware } from "../middleware/auth.middleware.js";
import { adminMiddleware } from "../middleware/admin.middleware.js";
import validation from "../middleware/validation.middleware.js";
import upload from "../middleware/multer.middleware.js";

// Validation
import {
  avatarSchema,
  createUser,
  updateUser,
  querySchema,
  roleSchema,
  statusSchema,
  passwordSchema,
  dateRangeSchema,
} from "../validations/validation.js";

const router = express.Router();

// --------------------------
// Protected Routes (Require authentication && Admin Require)
// --------------------------

router.use(authMiddleware);
router.use(adminMiddleware);

router
  .route("/")
  .get(validation(querySchema), adminController.getAllUsers)
  .post(
    validation(createUser),
    upload.single("avatar"),
    adminController.createUser
  );

router
  .route("/:id")
  .get(adminController.getUserDetails)
  .patch(validation(updateUser), adminController.updateUser)
  .delete(validation(passwordSchema), adminController.deleteUser);

router
  .route("/:id/avatar")
  .patch(
    validation(avatarSchema),
    upload.single("avatar"),
    adminController.updateAvatar
  );

router
  .route("/:id/role")
  .patch(validation(roleSchema), adminController.changeUserRole);

router
  .route("/:id/status")
  .patch(validation(statusSchema), adminController.changeUserStatus);

router
  .route("/metrics/users")
  .patch(validation(dateRangeSchema), adminController.getUserGrowthMetrics);

export default router;
