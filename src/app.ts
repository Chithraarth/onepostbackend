import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Allow the web app, Expo web preview (*.expo.sisko.replit.dev and other
// Replit dev/production domains), native apps (no Origin header), and local
// development. Reflecting the origin (instead of "*") keeps requests working
// even when credentials are included.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+([.-][a-z0-9-]+)*\.replit\.dev$/,
  /^https:\/\/[a-z0-9-]+([.-][a-z0-9-]+)*\.replit\.app$/,
  /^https:\/\/[a-z0-9-]+([.-][a-z0-9-]+)*\.repl\.co$/,
];

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (native apps, curl, same-origin)
      // are always allowed.
      if (!origin) return callback(null, true);
      const allowed = ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
      callback(null, allowed);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    maxAge: 86400,
  }),
);
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

// Resolve the publishable key from the incoming request host so the same
// server can serve multiple Clerk custom domains. Falls back to
// CLERK_PUBLISHABLE_KEY when the host doesn't map to a custom domain.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
