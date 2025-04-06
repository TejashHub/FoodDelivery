import { StatusCodes } from "http-status-codes";
import ApiError from "../utils/apiError";
import logger from "../logger/winston.logger";

export const adminMiddleware = (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }
    if (user.role !== "admin") {
      throw new ApiError(StatusCodes.FORBIDDEN, "Admin access required");
    }
    next();
  } catch (error) {
    logger.error(`Admin middleware error: ${error}`);
    next(error);
  }
};
