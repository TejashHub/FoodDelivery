import express from "express";

import { authMiddleware, authRoles } from "../middleware/auth.middleware.js";

import { adminController } from "../controllers/admin.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authRoles("admin"));

router
  .route("/")
  .get(adminController.getAllUsers)
  .post(adminController.createUser);

router
  .route("/:id")
  .get(adminController.getUserDetails)
  .delete(adminController.deleteUser);

router.route("/:id/role").patch(adminController.changeUserRole);

router.route("/:id/status").patch(adminController.changeUserStatus);

router.route("/metrics/users").patch(adminController.getUserGrowthMetrics);

router.route("/metrics/activity").patch(adminController.getUserActivityStats);

router.route("/metrics/retention").patch(adminController.getUserRetentionRates);

router.route("/system/health").patch(adminController.systemHealthCheck);

router.route("/system/logs").patch(adminController.getServerLogs);

router.route("/system/backup").patch(adminController.initiateDatabaseBackup);

export default router;
