import cors from "cors";
import express, {
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import router from "./routes";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import dotenv from "dotenv";
import { logger } from "./lib/logger";
import { connectDB } from "./lib/db";
import { env } from "./config/env";

dotenv.config();

connectDB();

// Initialize Express app
const apiVersion = env.API_VERSION || "v1";

// Middleware
const app = express();

app.use(helmet());
app.use(
  morgan("dev", { stream: { write: (message) => logger.info(message) } })
);
app.set("trust proxy", 1 /* number of proxies between user and server */);
function shouldCompress(req: any, res: any) {
  if (req.headers["x-no-compression"]) {
    // don't compress responses with this request header
    return false;
  }

  // fallback to standard filter function
  return compression.filter(req, res);
}

app.use(compression({ filter: shouldCompress }) as unknown as RequestHandler);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
app.use(
  cors({
    origin: [env.CLIENT_ORIGIN],
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })
);

// Middleware: Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
});

// Apply rate limiting and API routes
app.use(`/${apiVersion}/`, apiLimiter, router);

// 404 Handler
app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ message: "Endpoint Not Found" });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.stack);
  if (!res.headersSent) {
    // Prevent sending headers if already sent
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Start the Express server
const APP_PORT = env.APP_PORT || 8000;

app.listen(APP_PORT, () => {
  logger.info(`Express server listening on port http://localhost:${APP_PORT}`);
});
