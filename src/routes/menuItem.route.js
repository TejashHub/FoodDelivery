import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import MenuItemController from "../controllers/menuItem.controller.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

router
  .route("/")
  .get(authMiddleware, MenuItemController.getAllMenuItems)
  .post(
    authMiddleware,
    upload.fields([{ name: "images", maxCount: 20 }]),
    MenuItemController.createMenuItem
  );

router.route("/search").get(MenuItemController.searchMenuItems);

router
  .route("/:id")
  .get(authMiddleware, MenuItemController.getMenuItemById)
  .patch(
    authMiddleware,
    upload.fields([{ name: "images", maxCount: 20 }]),
    MenuItemController.updateMenuItem
  )
  .delete(authMiddleware, MenuItemController.deleteMenuItem);

router
  .route("/:id/availability")
  .patch(authMiddleware, MenuItemController.toggleMenuItemAvailability);

router
  .route("/:id/ratings")
  .patch(authMiddleware, MenuItemController.updateMenuItemRating);

router
  .route("/:id/best-seller")
  .patch(authMiddleware, MenuItemController.updateBestSellerStatus);

router
  .route("/:id/images")
  .patch(
    authMiddleware,
    upload.fields([{ name: "images", maxCount: 20 }]),
    MenuItemController.updateMenuItemImages
  );

router
  .route("/:id/order-count")
  .patch(authMiddleware, MenuItemController.incrementOrderCount);

router
  .route("/:id/customizations")
  .patch(authMiddleware, MenuItemController.updateCustomizationOptions);

router
  .route("/:id/addons")
  .patch(authMiddleware, MenuItemController.updateAddonGroups);

export default router;
