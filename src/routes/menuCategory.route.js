import express from "express";

import { MenuCategoryController } from "../controllers/menuCategory.controller.js";

import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

// --- 🔹 Custom Routes First to Avoid Conflict ---

// Display & Ordering
router.get("/sorted", authMiddleware, MenuCategoryController.sortedCategory);
router.post("/reorder", authMiddleware, MenuCategoryController.reorderCategory);

// Search & Filter
router.get("/search", authMiddleware, MenuCategoryController.searchCategory);
router.get("/filter", authMiddleware, MenuCategoryController.filterCategory);
router.get(
  "/time-available",
  authMiddleware,
  MenuCategoryController.timeAvailabilityCategory
);
router.get(
  "/day-available/:day",
  authMiddleware,
  MenuCategoryController.dayAvailablityCategory
);
router.get("/color/:color", MenuCategoryController.colorCategory);

// Bulk Operations
router.post(
  "/bulk/:restaurantId",
  authMiddleware,
  upload.fields(
    Array.from({ length: 10 }, (_, i) => ({
      name: `categories[${i}]image`,
      maxCount: 1,
    }))
  ),
  MenuCategoryController.createBulkCategory
);

router.patch(
  "/bulk/:restaurantId",
  authMiddleware,
  upload.fields(
    Array.from({ length: 10 }, (_, i) => ({
      name: `categories[${i}]image`,
      maxCount: 1,
    }))
  ),
  MenuCategoryController.updateBulkCategory
);

router.delete(
  "/bulk/:restaurantId",
  authMiddleware,
  MenuCategoryController.deleteBulkCategory
);

// --- 🔹 Core CRUD Operations ---

router.get(
  "/",
  authMiddleware,
  MenuCategoryController.getAllMenuCategoryController
);
router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  MenuCategoryController.createMenuCategoryController
);

router.get(
  "/:id",
  authMiddleware,
  MenuCategoryController.getMenuCategoryController
);
router.patch(
  "/:id",
  authMiddleware,
  upload.single("image"),
  MenuCategoryController.updateMenuCategoryController
);
router.delete(
  "/:id",
  authMiddleware,
  MenuCategoryController.deleteMenuCategoryController
);

// --- 🔹 Availability Management ---

router.post(
  "/:id/availability",
  authMiddleware,
  MenuCategoryController.availabilityCategory
);
router.post(
  "/:id/available-times",
  authMiddleware,
  MenuCategoryController.availableTimesCategory
);
router.post(
  "/:id/available-days",
  authMiddleware,
  MenuCategoryController.availableDaysCategory
);
router.get(
  "/:id/check-availability",
  authMiddleware,
  MenuCategoryController.checkAvailabilityCategory
);

// --- 🔹 Item Relationships ---

router.get("/:id/items", MenuCategoryController.itemsCategory);
router.get("/:id/items/featured", MenuCategoryController.itemsFeaturedCategory);
router.get("/:id/items/count", MenuCategoryController.countCategory);
router.post("/:id/items", MenuCategoryController.createItemCategory);
router.delete("/:id/items/:itemId", MenuCategoryController.deleteItemCategory);

// --- 🔹 Display & Ordering (with :id) ---

router.patch(
  "/:id/display-order",
  authMiddleware,
  MenuCategoryController.displayOrderCategory
);
router.patch(
  "/:id/featured-order",
  authMiddleware,
  MenuCategoryController.featuredOrderCategory
);

// --- 🔹 Media Management ---

router.post(
  "/:id/image",
  authMiddleware,
  upload.single("image"),
  MenuCategoryController.createCategoryImage
);
router.patch(
  "/:id/image",
  authMiddleware,
  upload.single("image"),
  MenuCategoryController.updateCategoryImage
);
router.delete(
  "/:id/image",
  authMiddleware,
  MenuCategoryController.deleteCategoryImage
);

// --- 🔹 SEO & Metadata (Admin Only) ---

router.use(authMiddleware);
router.use(adminMiddleware);
router.post("/:categoryId/metadata", MenuCategoryController.createMetaCategory);
router.patch(
  "/:categoryId/metadata",
  MenuCategoryController.updateMetaCategory
);
router.patch(
  "/:categoryId/keyword",
  MenuCategoryController.updateMetaKeywordCategory
);

export default router;
