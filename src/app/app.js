/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { CORS_ORIGIN } from "../constants/constant.js";
import router from "../routes/route.js";
import notFound from "../middlewares/notFound.middleware.js";

const app = express();

app.use(cookieParser());

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));

app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use(express.static("./public"));

app.use("/api/v1", router);

app.use(notFound);

export default app;
