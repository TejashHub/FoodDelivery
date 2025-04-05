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
