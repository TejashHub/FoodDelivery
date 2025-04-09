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

router
  .route("/:id")
  .get(authMiddleware, MenuItemController.getMenuItemById)
  .patch(authMiddleware, MenuItemController.updateMenuItem)
  .delete(authMiddleware, MenuItemController.deleteMenuItem);

router
  .route("/:id/availability")
  .patch(MenuItemController.toggleMenuItemAvailability);

router.route("/:id/ratings").patch(MenuItemController.updateMenuItemRating);

router.route("/:id/search").get(MenuItemController.searchMenuItems);

router
  .route("/:id/best-seller")
  .patch(MenuItemController.updateBestSellerStatus);

router.route("/:id/images").patch(MenuItemController.updateMenuItemImages);

router.route("/:id/order-count").patch(MenuItemController.incrementOrderCount);

router
  .route("/:id/customizations")
  .patch(MenuItemController.updateCustomizationOptions);

router.route("/:id/addons").patch(MenuItemController.updateAddonGroups);

export default router;
