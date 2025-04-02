/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

// Port for the application to listen on
export const PORT = process.env.PORT || 8000;

// MongoDB URI and Database name
export const MONGO_URI = process.env.MONGO_URI;
export const MONGO_DB = process.env.MONGO_DB;

// Cors origin configuration
export const CORS_ORIGIN = process.env.CORS_ORIGIN;

// Cloudinary API credentials
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_NAME = process.env.CLOUDINARY_NAME;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// JWT secret and expiry times
export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
export const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN;
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN;

// User Email Credentials
export const USER_EMAIL_ID = process.env.USER_EMAIL_ID;
export const USER_EMAIL_PASSWORD = process.env.USER_EMAIL_PASSWORD;

// Account Credentials
export const ACCOUNT_LOCK_DURATION = 15 * 60 * 1000;
export const MAX_LOGIN_ATTEMPTS = 5;
