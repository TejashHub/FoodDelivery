import express from "express";
import RestaurantController from "../../controllers/restaurant/restaurant.controller..js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Core Restaurant Routes
router
  .route("/")
  .get(authMiddleware, RestaurantController.getAllRestaurants)
  .post(authMiddleware, RestaurantController.createRestaurant)
  .delete(authMiddleware, RestaurantController.deleteManyRestaurants);

router
  .route("/:id")
  .get(authMiddleware, RestaurantController.getRestaurant)
  .patch(authMiddleware, RestaurantController.updateRestaurant)
  .delete(authMiddleware, RestaurantController.deleteRestaurant);

// Location-Based Routes
router
  .route("/nearby")
  .get(authMiddleware, RestaurantController.getNearbyRestaurants);
router
  .route("/city/:city")
  .get(authMiddleware, RestaurantController.getCityRestaurants);
router
  .route("/zone/:zoneId")
  .get(authMiddleware, RestaurantController.getZoneRestaurants);

// Status & Availability Routes
router
  .route("/:id/status")
  .patch(authMiddleware, RestaurantController.getRestaurantStatus);
router
  .route("/open")
  .get(authMiddleware, RestaurantController.isRestaurantOpen);
router
  .route("/:id/opening")
  .patch(authMiddleware, RestaurantController.updateRestaurantOpeningHours);
router
  .route("/:id/holidays")
  .patch(authMiddleware, RestaurantController.updateRestaurantHolidays);

// Menu Management Routes
router
  .route("/:id/menu")
  .get(authMiddleware, RestaurantController.getRestaurantMenu)
  .post(authMiddleware, RestaurantController.createRestaurantMenu);

router
  .route("/:id/menu/:menuId")
  .delete(authMiddleware, RestaurantController.deleteRestaurantMenu)
  .patch(authMiddleware, RestaurantController.updateRestaurantMenu);

router
  .route("/:id/menu/items")
  .post(authMiddleware, RestaurantController.createMultipleRestaurantMenus);

// Media Management Routes
router
  .route("/:id/logo")
  .post(authMiddleware, RestaurantController.updateRestaurantLogo);
router
  .route("/:id/cover")
  .post(authMiddleware, RestaurantController.updateRestaurantCoverImage);
router
  .route("/:id/images")
  .post(authMiddleware, RestaurantController.addRestaurantGalleryImage);
router
  .route("/:id/image/:imageId")
  .delete(authMiddleware, RestaurantController.deleteRestaurantImage);

// Delivery & Order Routes
router
  .route("/:id/delivery")
  .patch(authMiddleware, RestaurantController.updateDeliveryOptions)
  .get(authMiddleware, RestaurantController.getDeliveryOptions);
router
  .route("/:id/slots")
  .post(authMiddleware, RestaurantController.createDeliveryTimeSlot)
  .get(authMiddleware, RestaurantController.getDeliveryTimeSlots);

// Offers & Promotions Routes
router
  .route("/:id/offers")
  .post(authMiddleware, RestaurantController.createRestaurantOffer)
  .get(authMiddleware, RestaurantController.getActiveRestaurantOffers);
router
  .route("/offers/:offerId")
  .patch(authMiddleware, RestaurantController.updateRestaurantOffers)
  .patch(authMiddleware, RestaurantController.toggleRestaurantOffers);

// Analytics & Insights Routes
router
  .route("/:id/analytics")
  .get(authMiddleware, RestaurantController.getRestaurantAnalytics);
router
  .route("/:id/ratings")
  .get(authMiddleware, RestaurantController.getRestaurantRatingsAnalytics);
router
  .route("/:id/timings")
  .get(authMiddleware, RestaurantController.getRestaurantTimingsAnalytics);

// Search & Discovery Routes
router
  .route("/search")
  .get(authMiddleware, RestaurantController.searchRestaurants);
router
  .route("/filter")
  .get(authMiddleware, RestaurantController.filterRestaurants);
router
  .route("/trending")
  .get(authMiddleware, RestaurantController.getTrendingRestaurants);

// Administration & Verification Routes
router
  .route("/:id/verify")
  .get(authMiddleware, RestaurantController.verifyRestaurant);
router
  .route("/:id/owners")
  .patch(authMiddleware, RestaurantController.updateRestaurantOwners);
router
  .route("/:id/managers")
  .post(authMiddleware, RestaurantController.addRestaurantManager)
  .delete(authMiddleware, RestaurantController.removeRestaurantManager);

// Utility Endpoints Routes
router
  .route("/enums/cuisines")
  .get(authMiddleware, RestaurantController.getRestaurantCuisines);
router
  .route("/enums/food-types")
  .get(authMiddleware, RestaurantController.getRestaurantFoodTypes);
router
  .route("/status/:id")
  .get(authMiddleware, RestaurantController.getRestaurantStatus);

// Categories Endpoints Routesss
router
  .route("/:id/categories")
  .get(RestaurantController.getAllCategoryResturant);
router.route("/:id/categories/active").get(RestaurantController.activeCategory);
router
  .route("/:id/categories/featured")
  .get(RestaurantController.featuredCategory);
router
  .route("/:id/categories/popular")
  .get(RestaurantController.popularCategory);
router
  .route("/:id/categories/available-now")
  .get(RestaurantController.availableCategory);
router.route("/:id/categories/stats").get(RestaurantController.statsCategory);

export default router;
