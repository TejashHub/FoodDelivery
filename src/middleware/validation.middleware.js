import ApiError from "../utils/apiError.js";
import { StatusCodes } from "http-status-codes";

const validation = (schema) => (req, _, next) => {
  const options = {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true,
  };

  const { error, value } = schema.validate(req.body, options);

  if (error) {
    const errors = error.details.map((detail) => detail.message);
    throw new ApiError(StatusCodes.BAD_REQUEST, errors);
  }

  req.body = value;
  next();
};

export default validation;
