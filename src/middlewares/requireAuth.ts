import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Requires a signed-in Clerk user. Also just-in-time provisions a row in the
 * users table so subscription state can be tracked.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;

  // JIT provision the user record (no-op if it already exists).
  await db.insert(usersTable).values({ id: userId }).onConflictDoNothing();

  next();
}
