import Joi from "joi";

const fullNamePattern = /^[\p{L} '’-]+$/u;
const userNamePattern = /^[\p{L}0-9][\p{L}0-9_.-]{2,28}[\p{L}0-9]$/u;
const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const phonePattern = /^[+]?[(]?\d{3}[)]?[-\s.]?\d{3}[-\s.]?\d{4,6}$/;

// Common validation
export const emailSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

export const phoneSchema = Joi.object({
  phone: Joi.string().pattern(phonePattern).trim().messages({
    "string.pattern.base": "Invalid phone number format",
  }),
});

export const otpSchema = Joi.object({
  otp: Joi.string().length(6).required(),
});

export const avatarSchema = Joi.object({
  avatar: Joi.object({
    mimetype: Joi.string().valid("image/jpeg", "image/png"),
  }),
});

export const passwordSchema = Joi.object({
  password: Joi.string().pattern(passwordPattern).required().messages({
    "string.pattern.base":
      "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character",
  }),
});

export const roleSchema = Joi.object({
  role: Joi.string().valid("user", "admin", "moderator").required(),
});

// Authentication validation
export const registerSchema = Joi.object({
  fullName: Joi.string()
    .pattern(fullNamePattern)
    .trim()
    .min(2)
    .max(50)
    .required(),
  userName: Joi.string()
    .pattern(userNamePattern)
    .trim()
    .lowercase()
    .min(3)
    .max(30)
    .required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().pattern(passwordPattern).required().messages({
    "string.pattern.base":
      "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character",
  }),
  phone: Joi.string().pattern(phonePattern).trim().messages({
    "string.pattern.base": "Invalid phone number format",
  }),
  avatar: Joi.object({
    mimetype: Joi.string().valid("image/jpeg", "image/png"),
  }),
  addresses: Joi.array()
    .items(
      Joi.object({
        street: Joi.string().trim().required(),
        city: Joi.string().trim().required(),
        state: Joi.string().trim().required(),
        postalCode: Joi.string().trim().required(),
        country: Joi.string().trim().required(),
        latitude: Joi.number().min(-90).max(90),
        longitude: Joi.number().min(-180).max(180),
        isDefault: Joi.boolean(),
      })
    )
    .optional()
    .default([]),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().trim().lowercase(),
  userName: Joi.string().pattern(userNamePattern).trim().lowercase(),
  phone: Joi.string().pattern(phonePattern).trim().messages({
    "string.pattern.base": "Invalid phone number format",
  }),
  password: Joi.string().pattern(passwordPattern).required().messages({
    "string.pattern.base":
      "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character",
  }),
});

export const verifyEmailSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  otp: Joi.string().length(6).required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().trim().lowercase().required(),
  otp: Joi.string().length(6).required(),
  newPassword: Joi.string().pattern(passwordPattern).required().messages({
    "string.pattern.base":
      "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character",
  }),
});

// User validation
export const updateProfileScheme = Joi.object({
  fullName: Joi.string()
    .pattern(fullNamePattern)
    .trim()
    .min(2)
    .max(50)
    .required(),
  email: Joi.string().email().trim().lowercase().required(),
  userName: Joi.string().pattern(userNamePattern).trim().lowercase(),
});

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().pattern(passwordPattern).required().messages({
    "string.pattern.base":
      "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character",
  }),
  newPassword: Joi.string().pattern(passwordPattern).required().messages({
    "string.pattern.base":
      "Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character",
  }),
});

// Admin validation
