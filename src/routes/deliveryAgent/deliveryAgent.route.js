/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import { DeliveryAgentController } from "../../controllers/deliveryAgents/deliveryAgents.controller.js";
import {
  authMiddleware,
  authRoles,
} from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Core CRUD Operations
router
  .route("/")
  .post(DeliveryAgentController.createDeliveryAgent)
  .get(DeliveryAgentController.getAllDeliveryAgents);

router
  .route("/:agentId")
  .get(DeliveryAgentController.getDeliveryAgentById)
  .patch(DeliveryAgentController.updateDeliveryAgent)
  .delete(DeliveryAgentController.deleteDeliveryAgent);

// Availability Management
router
  .route("/:agentId/availability")
  .patch(DeliveryAgentController.toggleAvailability);

// Location Management
router
  .route("/:agentId/location")
  .patch(DeliveryAgentController.updateLocation);

// Order Operations
router
  .route("/:agentId/current-order")
  .patch(DeliveryAgentController.assignCurrentOrder);

router
  .route("/:agentId/complete-order")
  .patch(DeliveryAgentController.completeCurrentOrder);

// History and Stats
router
  .route("/:agentId/order-history")
  .get(DeliveryAgentController.getOrderHistory);

router.route("/:agentId/stats").get(DeliveryAgentController.getAgentStats);

// Rating Operations
router.route("/:agentId/rating").patch(DeliveryAgentController.updateRating);

// Bulk Operations (Admin only)
router.use(authRoles("admin"));
router
  .route("/bulk")
  .post(DeliveryAgentController.bulkCreateDeliveryAgents)
  .delete(DeliveryAgentController.bulkDeleteDeliveryAgents);

// Filtering Endpoints
router
  .route("/available")
  .get(DeliveryAgentController.getAvailableDeliveryAgents);

router
  .route("/top-rated")
  .get(DeliveryAgentController.getTopRatedDeliveryAgents);

router.route("/nearby").get(DeliveryAgentController.getNearbyDeliveryAgents);

export default router;
