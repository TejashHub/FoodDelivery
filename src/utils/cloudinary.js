/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

import {
  CLOUDINARY_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} from "../constant/constant.js";

cloudinary.config({
  cloud_name: CLOUDINARY_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const cloudinaryFileUpload = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlink(localFilePath);
    return null;
  }
};

const cloudinaryFileRemove = async (localFilePath) => {
  try {
    return await cloudinary.uploader.destroy(localFilePath);
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

export { cloudinaryFileUpload, cloudinaryFileRemove };
