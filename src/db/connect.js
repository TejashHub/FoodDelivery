/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import mongoose from "mongoose";

const connectDB = async (url, dbName) => {
  try {
    await mongoose.connect(`${url}/${dbName}`);
  } catch (error) {
    console.log(`Database connection failed : ${error}`);
    process.exit(1);
  }
};

export default connectDB;
