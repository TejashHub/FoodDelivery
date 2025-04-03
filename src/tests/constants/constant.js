/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

// Port for the application to listen on
export const NODE_ENV = process.env.NODE_ENV;
export const PORT = process.env.PORT || 5001;

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
