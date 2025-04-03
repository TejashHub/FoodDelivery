import express from "express";
import {
  authRoles,
  authMiddleware,
} from "../../middlewares/auth.middleware.js";
import { AddressController } from "../../controllers/address/address.controller";

const router = express.Router();

router
  .route("/")
  .get(AddressController.getAllAddress)
  .post(AddressController.createAddress);

router
  .route("/:id")
  .get(AddressController.getAddress)
  .patch(AddressController.updateAddress)
  .delete(AddressController.deleteAddress);

router.route("/user/:userId").get(AddressController.getAllAddress);

router
  .route("/:id/set-default")
  .patch(AddressController.updateSetDefaultAddress);

router.route("/validate").post(AddressController.validateDefaultAddress);

router.route("/nearby/:id").get(AddressController.nearByAddress);

router.route("/:id/delivery-check").get(AddressController.deliveryCheckAddress);

router
  .route("/")
  .get(authRoles("admin"), authMiddleware, AddressController.getAdminAddress);

router
  .route("/:id")
  .get(
    authRoles("admin"),
    authMiddleware,
    AddressController.getAllAdminAddress
  );

export default router;
