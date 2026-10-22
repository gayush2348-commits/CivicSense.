import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";
import complaintRoutes from "./routes/complaint.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, e.g. curl.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/health", healthRoutes);

app.use("/api/complaints", complaintRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/auth", authRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
