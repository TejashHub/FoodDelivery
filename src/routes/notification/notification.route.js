/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import { NotificationController } from "../../controllers/notification/notification.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Core CRUD Operations
router
  .route("/")
  .post(NotificationController.createNotification)
  .get(NotificationController.getUserNotifications);

router
  .route("/:id")
  .get(NotificationController.getNotificationById)
  .patch(NotificationController.updateNotification)
  .delete(NotificationController.deleteNotification);

// Read Status Management
router
  .route("/:notificationId/mark-read")
  .patch(NotificationController.markAsRead);

router
  .route("/users/:userId/mark-all-read")
  .patch(NotificationController.markAllAsRead);

router
  .route("/users/:userId/unread-count")
  .get(NotificationController.getUnreadCount);

// Filtering Operations
router
  .route("/users/:userId/type/:type")
  .get(NotificationController.getNotificationsByType);

router
  .route("/users/:userId/priority")
  .get(NotificationController.getPriorityNotifications);

// Bulk & System Operations
router.route("/bulk/send").post(NotificationController.bulkSendNotifications);

router
  .route("/system/clear-expired")
  .delete(NotificationController.clearExpiredNotifications);

export default router;
