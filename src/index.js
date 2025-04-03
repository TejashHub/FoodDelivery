/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import app from "./app/app.js";
import dotenv from "dotenv";
import connectDB from "./db/connect.js";
import { PORT, MONGO_URI, MONGO_DB } from "./constants/constant.js";

dotenv.config({
  path: "./.env",
});

connectDB(MONGO_URI, MONGO_DB)
  .then(() => {
    app.listen(3000, () => {
      console.log(`Server is running on port http://localhost:${PORT}`);
    });
  })
  .catch(() => {
    console.log(`Server connection failed: ${error}`);
    process.exit(1);
  });
