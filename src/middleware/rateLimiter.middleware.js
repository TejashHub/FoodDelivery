import rateLimit from "express-rate-limit";

// Authentication limit
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many requests from this IP, please try again later",
  skipSuccessfulRequests: true,
});

// Password Reset Limit
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many password reset attempts, please try again later",
});

const rateLimiter = (limit, windowInSeconds) => async (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `rate_limit:${ip}:${req.path}`;

  try {
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.expire(key, windowInSeconds);
    }

    if (current > limit) {
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        `Too many requests. Please try again in ${windowInSeconds} seconds.`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default rateLimiter;
