/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 * @description Standardized API response formatter
 */

class ApiResponse {
  constructor(statusCode, data, message = "Success", metadata = {}) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    this.metadata = metadata;
  }

  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
      ...(Object.keys(this.metadata).length && { meta: this.metadata }),
    });
  }

  static success(data, message = "Operation successful", metadata = {}) {
    return new ApiResponse(200, data, message, metadata);
  }

  static created(data, message = "Resource created successfully") {
    return new ApiResponse(201, data, message);
  }

  static noContent(message = "No content") {
    return new ApiResponse(204, null, message);
  }
}

export default ApiResponse;
