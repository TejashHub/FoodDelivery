/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import jwt from "jsonwebtoken";
import User from "../model/user.model.js";
import asyncHandler from "../middleware/asyncHandler.middleware.js";
import { ACCESS_TOKEN_SECRET } from "../constant/constant.js";
import { ApiError } from "../errors/ApiError.js";
import { StatusCodes } from "http-status-codes";
import { TokenBlacklist } from "../model/user.model.js";
import Admin from "../model/admin.model.js";

export const authMiddleware = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
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
      "-password -refreshToken -resetPasswordToken -otp"
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
