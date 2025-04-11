import express from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import adminMiddleware from "../../middleware/admin.middleware.js";

import AddressController from "../../controllers/address.controller.js";

const router = express.Router();
router
  .route("/")
  .get(authMiddleware, AddressController.getAllAddress)
  .post(authMiddleware, AddressController.createAddress);

router
  .route("/:id")
  .get(authMiddleware, AddressController.getAddress)
  .patch(authMiddleware, AddressController.updateAddress)
  .delete(authMiddleware, AddressController.deleteAddress);

router
  .route("/user/:userId")
  .get(authMiddleware, AddressController.getAllAddress);

router
  .route("/:id/set-default")
  .patch(authMiddleware, AddressController.updateSetDefaultAddress);

router
  .route("/validate")
  .post(authMiddleware, AddressController.validateDefaultAddress);

router
  .route("/nearby/:id")
  .get(authMiddleware, AddressController.nearByAddress);

router
  .route("/:id/delivery-check")
  .get(authMiddleware, AddressController.deliveryCheckAddress);

router
  .route("/")
  .get(authMiddleware, adminMiddleware, AddressController.getAdminAddress);

router
  .route("/:id")
  .get(authMiddleware, adminMiddleware, AddressController.getAllAdminAddress);

export default router;
