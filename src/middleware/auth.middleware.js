/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import jwt from "jsonwebtoken";
import User from "../model/user.model.js";
import { asyncHandler } from ".././middleware/asyncHandler.middleware.js";
import { ACCESS_TOKEN_SECRET } from "../constant/constant.js";

export const authMiddleware = asyncHandler(async (req, _) => {
  try {
    const token =
      req.cookies?.access_token ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required");
    }

    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid token");
    }

    const user = await User.findById(decoded._id).select(
      "-password -refreshToken"
    );
    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid token");
    }
    throw error;
  }
});

export const authorize = (...roles) => {
  return (req, _, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You are not authorized to access this resource"
      );
    }
    next();
  };
};
