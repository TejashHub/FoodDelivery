import express from "express";
import { DishesController } from "../../controllers/dishes/dishes.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import upload from "../../middleware/multer.middleware.js";

const router = express.Router();

router.route("/").get(DishesController.getAllDishes);
router.route("/search").get(DishesController.searchDishes);
router.route("/category/:category").get(DishesController.getDishesByCategory);

router.use(authMiddleware);
router.route("/").post(DishesController.createDish);
router.route("/:id").post(DishesController.updateDish);
router.route("/:id/availability").post(DishesController.toggleAvailability);
router
  .route("/image")
  .post(upload.single("image"), DishesController.uploadImage);

export default router;
