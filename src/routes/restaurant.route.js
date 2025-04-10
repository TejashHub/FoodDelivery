import express from "express";

// Controller
import RestaurantController from "../controllers/restaurant.controller.js";

// Middlewares
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";
import upload from "../middleware/multer.middleware.js";

const router = express.Router();

// ====================== PUBLIC ROUTES (No Auth) ======================

const publicRouter = express.Router();

// Category Endpoints
publicRouter.get(
  "/:id/categories",
  RestaurantController.getAllCategoryRestaurant
);
publicRouter.get("/:id/categories/active", RestaurantController.activeCategory);
publicRouter.get(
  "/:id/categories/featured",
  RestaurantController.featuredCategory
);
publicRouter.get(
  "/:id/categories/popular",
  RestaurantController.popularCategory
);
publicRouter.get(
  "/:id/categories/available-now",
  RestaurantController.availableCategory
);
publicRouter.get("/:id/categories/stats", RestaurantController.statsCategory);

// ====================== PROTECTED ROUTES (Auth Required) ======================

const protectedRouter = express.Router();

protectedRouter.use(authMiddleware);

// Search & Discovery
protectedRouter.get("/search", RestaurantController.searchRestaurants);
protectedRouter.get("/filter", RestaurantController.filterRestaurants);
protectedRouter.get("/trending", RestaurantController.getTrendingRestaurants);

// Core Restaurant Operations
protectedRouter
  .route("/")
  .get(RestaurantController.getAllRestaurants)
  .post(
    upload.fields([
      { name: "logo", maxCount: 1 },
      { name: "coverImage", maxCount: 1 },
      { name: "images", maxCount: 10 },
      { name: "menuImages", maxCount: 10 },
    ]),
    RestaurantController.createRestaurant
  )
  .delete(RestaurantController.deleteManyRestaurants);

protectedRouter
  .route("/:id")
  .get(RestaurantController.getRestaurant)
  .patch(
    upload.fields([
      { name: "logo", maxCount: 1 },
      { name: "coverImage", maxCount: 1 },
      { name: "images", maxCount: 10 },
      { name: "menuImages", maxCount: 10 },
    ]),
    RestaurantController.updateRestaurant
  )
  .delete(RestaurantController.deleteRestaurant);

// Location-Based
protectedRouter.get(
  "/location/nearby",
  RestaurantController.getNearbyRestaurants
);
protectedRouter.get(
  "/location/city/:city",
  RestaurantController.getCityRestaurants
);
protectedRouter.post(
  "/location/zone/:zoneId",
  RestaurantController.getZoneRestaurants
);

// // Status & Availability
protectedRouter.get("/:id/status", RestaurantController.getRestaurantStatus);
protectedRouter.get("/:id/open", RestaurantController.isRestaurantOpen);
protectedRouter.patch(
  "/:id/opening",
  RestaurantController.updateRestaurantOpeningHours
);
protectedRouter.patch(
  "/:id/holidays",
  RestaurantController.updateRestaurantHolidays
);

// // Menu Management
protectedRouter
  .route("/:id/menu")
  .get(RestaurantController.getRestaurantMenu)
  .post(RestaurantController.createRestaurantMenu);

protectedRouter
  .route("/:id/menu/:menuId")
  .delete(RestaurantController.deleteRestaurantMenu)
  .patch(RestaurantController.updateRestaurantMenu);

protectedRouter.post(
  "/:id/menu/items",
  RestaurantController.createMultipleRestaurantMenus
);

// Media Management
protectedRouter.patch(
  "/:id/logo",
  upload.single("logo"),
  RestaurantController.updateRestaurantLogo
);
protectedRouter.patch(
  "/:id/cover-image",
  upload.single("coverImage"),
  RestaurantController.updateRestaurantCoverImage
);
protectedRouter.post(
  "/:id/images",
  upload.array("images", 50),
  RestaurantController.addRestaurantGalleryImage
);
protectedRouter.delete(
  "/:id/image/:imageId",
  upload.single("images"),
  RestaurantController.deleteRestaurantImage
);

// // Delivery & Order
protectedRouter
  .route("/:id/delivery")
  .patch(RestaurantController.updateDeliveryOptions)
  .get(RestaurantController.getDeliveryOptions);

protectedRouter
  .route("/:id/slots")
  .post(RestaurantController.createDeliveryTimeSlot)
  .get(RestaurantController.getDeliveryTimeSlots);

// Offers & Promotions
protectedRouter
  .route("/:id/offers")
  .post(RestaurantController.createRestaurantOffer)
  .get(RestaurantController.getActiveRestaurantOffers);

// // Utility Endpoints
// protectedRouter.get(
//   "/enums/cuisines",
//   RestaurantController.getRestaurantCuisines
// );
// protectedRouter.get(
//   "/enums/food-types",
//   RestaurantController.getRestaurantFoodTypes
// );
// protectedRouter.get("/status/:id", RestaurantController.getRestaurantStatus);

// ====================== ADMIN ROUTES (Auth + Admin Required) ======================

const adminRouter = express.Router();
adminRouter.use(authMiddleware, adminMiddleware);

// // Administration
// adminRouter.get("/:id/verify", RestaurantController.verifyRestaurant);
// adminRouter.patch("/:id/owners", RestaurantController.updateRestaurantOwners);
// adminRouter
//   .route("/:id/managers")
//   .post(RestaurantController.addRestaurantManager)
//   .delete(RestaurantController.removeRestaurantManager);

// Offers Management
adminRouter
  .route("/offers/:offerId")
  .patch(RestaurantController.updateRestaurantOffers)
  .patch(RestaurantController.toggleRestaurantOffers);

// Analytics
adminRouter.get("/:id/analytics", RestaurantController.getRestaurantAnalytics);
adminRouter.get(
  "/:id/ratings",
  RestaurantController.getRestaurantRatingsAnalytics
);
adminRouter.get(
  "/:id/timings",
  RestaurantController.getRestaurantTimingsAnalytics
);

// ====================== COMBINE ALL ROUTES ======================

router.use(publicRouter);
router.use(protectedRouter);
router.use(adminRouter);

export default router;
