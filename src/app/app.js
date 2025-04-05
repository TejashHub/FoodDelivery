/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

import { CORS_ORIGIN } from "../constants/constant.js";
import router from "../routes/route.js";
import notFound from "../middleware/notFound.middleware.js";

const app = express();

// Security Middleware
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

// Data Parsing
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Cookie Parser (after JSON body parser)
app.use(cookieParser());

// Gzip Compression
app.use(compression());

// Serve Static Files (Place BEFORE routes)
app.use(express.static("./public"));

// API Routes
app.use("/api/v1", router);

// Handle 404 Routes
app.use(notFound);

export default app;
