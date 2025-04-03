/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import app from "./app/app.js";
import dotenv from "dotenv";
import connectDB from "./db/connect.js";
import { NODE_ENV, PORT, MONGO_URI, MONGO_DB } from "./constants/constant.js";

dotenv.config({
  path: "./.env",
});

connectDB(MONGO_URI, MONGO_DB)
  .then(() => {
    app.listen(PORT || 3000, () => {
      console.log(`Server running on port http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`Server connection failed: ${error.message}`);
    process.exit(1);
  });
