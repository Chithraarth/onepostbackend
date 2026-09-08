import type { Request, Response, NextFunction } from "express";
import { firebaseAuth } from "../lib/firebase";
import { db, usersTable } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const isPreviewMode = (): boolean =>
  process.env.NODE_ENV !== "production" && process.env.PREVIEW_MODE !== "false";

const PREVIEW_USER_ID = "preview-user";
const PREVIEW_USER_EMAIL = "preview@onepost.test";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

async function provisionUser(userId: string, email?: string): Promise<void> {
  await db
    .insert(usersTable)
    .values({ id: userId, email })
    .onConflictDoNothing();
}

/**
 * Requires a signed-in Firebase user (verified from the `Authorization:
 * Bearer <idToken>` header). Also just-in-time provisions a row in the
 * users table so subscription state can be tracked.
 *
 * In non-production environments (PREVIEW_MODE), missing or invalid tokens
 * fall back to a fixed preview user instead of failing, so the frontend/
 * mobile apps can be developed without a real Firebase sign-in on every run.
 * Set PREVIEW_MODE=false to disable this locally.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    if (isPreviewMode()) {
      req.userId = PREVIEW_USER_ID;
      await provisionUser(PREVIEW_USER_ID, PREVIEW_USER_EMAIL);
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    req.userId = decoded.uid;
    await provisionUser(decoded.uid, decoded.email);
    next();
  } catch {
    if (isPreviewMode()) {
      req.userId = PREVIEW_USER_ID;
      await provisionUser(PREVIEW_USER_ID, PREVIEW_USER_EMAIL);
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
  }
}
