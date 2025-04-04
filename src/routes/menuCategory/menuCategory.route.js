import {
  authRoles,
  authMiddleware,
} from "../../middlewares/auth.middleware.js";
import { MenuCategoryController } from "../../controllers/menuCategory/menuCategory.controller.js";
import express from "express";

const router = express.Router();

// Core CRUD Operations
router
  .route("/")
  .get(authMiddleware, MenuCategoryController.getAllMenuCategoryController)
  .post(authMiddleware, MenuCategoryController.createMenuCategoryController);
router
  .route("/:id")
  .get(authMiddleware, MenuCategoryController.getMenuCategoryController)
  .patch(authMiddleware, MenuCategoryController.updateMenuCategoryController)
  .delete(authMiddleware, MenuCategoryController.deleteMenuCategoryController);

// Availability Management
router
  .route("/:id/availability")
  .get(authMiddleware, MenuCategoryController.availabilityCategory);
router
  .route("/:id/available-times")
  .get(authMiddleware, MenuCategoryController.availableTimesCategory);
router
  .route("/:id/available-days")
  .get(authMiddleware, MenuCategoryController.availableTimesCategory);
router
  .route("/:id/check-availability")
  .get(authMiddleware, MenuCategoryController.checkAvailabilityCategory);

// Item Relationships
router.route("/:id/items").get(MenuCategoryController.itemsCategory);
router
  .route("/:id/items/featured")
  .get(MenuCategoryController.itemsFeaturedCategory);
router.route("/:id/items/count").get(MenuCategoryController.countCategory);
router.route("/:id/items").post(MenuCategoryController.createItemCategory);
router
  .route("/:id/items/:itemId")
  .delete(MenuCategoryController.deleteItemCategory);

// Display & Ordering
router
  .route("/:id/display-order")
  .patch(MenuCategoryController.displayOrderCategory);
router
  .route("/:id/featured-order")
  .patch(MenuCategoryController.featuredOrderCategory);
router.route("/sorted").get(MenuCategoryController.sortedCategory);
router.route("/reorder").post(MenuCategoryController.reorderCategory);

// Media Management
router.route("/:id/image").post(MenuCategoryController.createCategoryImage);
router.route("/:id/image").patch(MenuCategoryController.updateCategoryImage);
router.route("/:id/icon").delete(MenuCategoryController.deleteCategoryImage);

// Search & Filter
router.route("/search").get(MenuCategoryController.searchCategory);
router.route("/filter").get(MenuCategoryController.filterCategory);
router
  .route("/time-available")
  .get(MenuCategoryController.timeAvailabilityCategory);
router
  .route("/day-available/:day")
  .get(MenuCategoryController.dayAvailablityCategory);
router.route("/color/:color").get(MenuCategoryController.colorCategory);

// Bulk Operations
router.route("/bulk").post(MenuCategoryController.createBulkCategory);
router.route("/bulk").patch(MenuCategoryController.updateBulkCategory);
router.route("/bulk").delete(MenuCategoryController.deleteBulkCategory);

// SEO & Metadata
router.route("/:id/metadata").post(MenuCategoryController.createBulkCategory);
router.route("/:id/metadata").patch(MenuCategoryController.updateBulkCategory);
router.route("/:id/keyword").delete(MenuCategoryController.deleteBulkCategory);

export default router;
