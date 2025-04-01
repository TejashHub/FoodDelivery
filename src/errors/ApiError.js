/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.message = message || "Something went wrong";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message) {
    return new ApiError(400, message || "Bad Request");
  }

  static unauthorized(message) {
    return new ApiError(401, message || "Unauthorized");
  }

  static forbidden(message) {
    return new ApiError(403, message || "Forbidden");
  }

  static notFound(message) {
    return new ApiError(404, message || "Not Found");
  }

  static internalServerError(message) {
    return new ApiError(500, message || "Internal Server Error");
  }
}
