/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import dotenv from "dotenv";
import app from "./app/app.js";
import connectDB from "./config/database.config.js";
import { PORT, MONGO_URI, MONGO_DB } from "./constants/constant.js";
import logger from "./logger/winston.logger.js";

dotenv.config({ path: "./.env" });

connectDB(MONGO_URI, MONGO_DB)
  .then(() => {
    const port = PORT || 3000;
    app.listen(port, () => {
      logger.info(`Server running on: http://localhost:${port}`);
    });
  })
  .catch((error) => {
    logger.error("Mongo db connect error: ", err);
    process.exit(1);
  });
