// External Package
import { StatusCodes } from "http-status-codes";

// Utils
import ApiError from "../utils/apiError.js";

// Logger
import logger from "../logger/winston.logger.js";

const adminMiddleware = (req, _, next) => {
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

export default adminMiddleware;
