/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import { DeliveryZoneController } from "../../controllers/deliveryZone/deliveryZone.controller.js";
import {
  authMiddleware,
  authRoles,
} from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Core CRUD Routes
router
  .route("/")
  .post(DeliveryZoneController.createDeliveryZone)
  .get(DeliveryZoneController.getAllDeliveryZones);

router
  .route("/:zoneId")
  .get(DeliveryZoneController.getDeliveryZoneById)
  .patch(DeliveryZoneController.updateDeliveryZone)
  .delete(DeliveryZoneController.deleteDeliveryZone);

// Status Management
router.route("/:zoneId/status").patch(DeliveryZoneController.toggleZoneStatus);

// Restaurant Management
router
  .route("/:zoneId/restaurants")
  .post(DeliveryZoneController.addRestaurantsToZone)
  .delete(DeliveryZoneController.removeRestaurantsFromZone);

// Geo Operations
router
  .route("/check-coverage")
  .get(DeliveryZoneController.checkLocationCoverage);

router.route("/nearby").get(DeliveryZoneController.getNearbyZones);

// Bulk Operations (Admin only)
router.use(authRoles("admin"));
router
  .route("/bulk")
  .post(DeliveryZoneController.bulkCreateDeliveryZones)
  .delete(DeliveryZoneController.bulkDeleteDeliveryZones);

export default router;
