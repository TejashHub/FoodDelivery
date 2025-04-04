/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import { ReviewController } from "../../controllers/reviews/reviews.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router
  .route("/")
  .post(ReviewController.createReview)
  .get(ReviewController.getAllReview);
router
  .route("/:id")
  .get(ReviewController.getReview)
  .patch(ReviewController.updateReview)
  .delete(ReviewController.deleteReview);
router.route("/bulk/delete").delete(ReviewController.deleteManyReview);
router
  .route("/restaurant/:restaurantId")
  .get(ReviewController.getReviewByRestaurant);
router.route("/user/:userId").get(ReviewController.getReviewByUser);

export default router;
