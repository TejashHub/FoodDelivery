/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import {
  createReview,
  getAllReview,
  getReview,
  updateReview,
  deleteReview,
  deleteManyReview,
  getReviewByRestaurant,
  getReviewByUser,
} from "../../controllers/review/review.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.route("/").post(createReview).get(getAllReview);

router.route("/:id").get(getReview).patch(updateReview).delete(deleteReview);

router.route("/bulk/delete").delete(deleteManyReview);

router.route("/restaurant/:restaurantId").get(getReviewByRestaurant);
router.route("/user/:userId").get(getReviewByUser);

export default router;
