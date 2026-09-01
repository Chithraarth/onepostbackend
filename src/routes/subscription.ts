import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, usersTable, postsTable } from "@workspace/db";
import {
  GetSubscriptionResponse,
  ClaimFreeMonthResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

const MONTHLY_PRICE_INR = 99;
const FREE_MONTH_PLATFORM_TARGET = 3;

async function getSharedPlatforms(userId: string): Promise<string[]> {
  const posts = await db
    .select({ platforms: postsTable.platforms, status: postsTable.status })
    .from(postsTable)
    .where(eq(postsTable.userId, userId));

  const platforms = new Set<string>();
  for (const post of posts) {
    if (post.status !== "shared") continue;
    for (const p of post.platforms) platforms.add(p);
  }
  return [...platforms];
}

function buildStatus(user: typeof usersTable.$inferSelect) {
  const now = new Date();
  const active =
    (user.subscriptionStatus === "active" ||
      user.subscriptionStatus === "trial") &&
    user.subscriptionEndsAt != null &&
    user.subscriptionEndsAt > now;
  return {
    status: active ? user.subscriptionStatus : "none",
    isActive: active,
    subscriptionEndsAt: active ? user.subscriptionEndsAt : null,
    freeMonthClaimed: user.freeMonthClaimed,
    priceInr: MONTHLY_PRICE_INR,
    freeMonthPlatformTarget: FREE_MONTH_PLATFORM_TARGET,
  };
}

router.get("/subscription", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const sharedPlatforms = await getSharedPlatforms(userId);
  const base = buildStatus(user);
  res.json(
    GetSubscriptionResponse.parse(
      serializeDates({
        ...base,
        sharedPlatforms,
        freeMonthEligible:
          !user.freeMonthClaimed &&
          sharedPlatforms.length >= FREE_MONTH_PLATFORM_TARGET,
      }),
    ),
  );
});

router.post("/subscription/claim-free-month", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.freeMonthClaimed) {
    res.status(409).json({ error: "Free month already claimed" });
    return;
  }

  const sharedPlatforms = await getSharedPlatforms(userId);
  if (sharedPlatforms.length < FREE_MONTH_PLATFORM_TARGET) {
    res.status(409).json({
      error: `Share posts to at least ${FREE_MONTH_PLATFORM_TARGET} different platforms to unlock the free month`,
    });
    return;
  }

  // Extend from the current expiry if a subscription is already running.
  const now = new Date();
  const from =
    user.subscriptionEndsAt && user.subscriptionEndsAt > now
      ? user.subscriptionEndsAt
      : now;
  const endsAt = new Date(from.getTime());
  endsAt.setMonth(endsAt.getMonth() + 1);

  // Conditional update guards against double-claiming under concurrent requests.
  const [updated] = await db
    .update(usersTable)
    .set({
      freeMonthClaimed: true,
      subscriptionStatus:
        user.subscriptionStatus === "active" ? "active" : "trial",
      subscriptionEndsAt: endsAt,
    })
    .where(
      and(eq(usersTable.id, userId), eq(usersTable.freeMonthClaimed, false)),
    )
    .returning();

  if (!updated) {
    res.status(409).json({ error: "Free month already claimed" });
    return;
  }

  const base = buildStatus(updated);
  res.json(
    ClaimFreeMonthResponse.parse(
      serializeDates({
        ...base,
        sharedPlatforms,
        freeMonthEligible: false,
      }),
    ),
  );
});

router.post("/subscription/subscribe", async (_req, res): Promise<void> => {
  // Online payments are not connected yet — this endpoint intentionally
  // fails loudly instead of pretending a payment happened.
  res.status(501).json({
    error:
      "Online payments are not set up yet. Connect a payment provider to enable the ₹99/month subscription.",
  });
});

export default router;
