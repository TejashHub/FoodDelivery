/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import mongoose from "mongoose";
// import User from "../model/user.model.js";
// import userdata from "../../userdata.js";

const connectDB = async (url, dbName) => {
  try {
    await mongoose.connect(`${url}/${dbName}`);
    // await User.insertMany(userdata);
  } catch (error) {
    console.log(`Database connection failed : ${error}`);
    process.exit(1);
  }
};

export default connectDB;
