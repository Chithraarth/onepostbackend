import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, postsTable, designsTable, accountsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [posts, designs, accounts] = await Promise.all([
    db.select().from(postsTable).where(eq(postsTable.userId, req.userId!)),
    db.select().from(designsTable).where(eq(designsTable.userId, req.userId!)),
    db.select().from(accountsTable).where(eq(accountsTable.userId, req.userId!)),
  ]);

  const platformCounts = new Map<string, number>();
  for (const post of posts) {
    if (post.status !== "shared") continue;
    for (const platform of post.platforms) {
      platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
    }
  }

  const summary = {
    totalPosts: posts.length,
    sharedPosts: posts.filter((p) => p.status === "shared").length,
    draftPosts: posts.filter((p) => p.status === "draft").length,
    scheduledPosts: posts.filter((p) => p.status === "scheduled").length,
    connectedAccounts: accounts.filter((a) => a.enabled).length,
    totalDesigns: designs.length,
    platformShareCounts: [...platformCounts.entries()]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count),
  };

  res.json(GetDashboardSummaryResponse.parse(serializeDates(summary)));
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const [posts, designs, accounts] = await Promise.all([
    db
      .select()
      .from(postsTable)
      .where(eq(postsTable.userId, req.userId!))
      .orderBy(desc(postsTable.createdAt))
      .limit(10),
    db
      .select()
      .from(designsTable)
      .where(eq(designsTable.userId, req.userId!))
      .orderBy(desc(designsTable.createdAt))
      .limit(10),
    db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.userId, req.userId!))
      .orderBy(desc(accountsTable.createdAt))
      .limit(10),
  ]);

  type Item = {
    id: number;
    type: string;
    title: string;
    detail: string | null;
    timestamp: Date;
  };

  const items: Item[] = [];

  for (const post of posts) {
    if (post.status === "shared" && post.sharedAt) {
      items.push({
        id: post.id,
        type: "post_shared",
        title:
          post.caption.length > 80
            ? `${post.caption.slice(0, 80)}…`
            : post.caption,
        detail: post.platforms.join(", "),
        timestamp: post.sharedAt,
      });
    } else {
      items.push({
        id: post.id,
        type: "post_created",
        title:
          post.caption.length > 80
            ? `${post.caption.slice(0, 80)}…`
            : post.caption,
        detail: post.status,
        timestamp: post.createdAt,
      });
    }
  }

  for (const design of designs) {
    items.push({
      id: design.id,
      type: "design_saved",
      title: design.title,
      detail: design.format,
      timestamp: design.createdAt,
    });
  }

  for (const account of accounts) {
    items.push({
      id: account.id,
      type: "account_linked",
      title: account.displayName,
      detail: account.platform,
      timestamp: account.createdAt,
    });
  }

  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  res.json(GetRecentActivityResponse.parse(serializeDates(items.slice(0, 15))));
});

export default router;
