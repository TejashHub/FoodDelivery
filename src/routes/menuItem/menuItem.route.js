import express from "express";
import { MenuItemController } from "../../controllers/menuItems/menuItem.controller.js";

const router = express.Router();

router
  .route("/")
  .get(MenuItemController.getAllMenuItems)
  .post(MenuItemController.createMenuItem);
router
  .route("/:id")
  .patch(MenuItemController.updateMenuItem)
  .delete(MenuItemController.deleteMenuItem);
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
