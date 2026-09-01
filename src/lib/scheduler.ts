import { and, eq, lte } from "drizzle-orm";
import { db, postsTable } from "@workspace/db";

const CHECK_INTERVAL_MS = 60_000;

/**
 * Publishes due scheduled posts: any post with status "scheduled" whose
 * scheduledAt has passed is marked shared (sharedAt = now). Runs every minute.
 */
async function publishDuePosts(): Promise<void> {
  const now = new Date();
  const published = await db
    .update(postsTable)
    .set({ status: "shared", sharedAt: now })
    .where(
      and(
        eq(postsTable.status, "scheduled"),
        lte(postsTable.scheduledAt, now),
      ),
    )
    .returning({ id: postsTable.id });

  if (published.length > 0) {
    console.log(
      `[scheduler] Published ${published.length} scheduled post(s): ${published
        .map((p) => p.id)
        .join(", ")}`,
    );
  }
}

export function startScheduler(): void {
  const tick = () => {
    publishDuePosts().catch((err) => {
      console.error("[scheduler] Failed to publish scheduled posts", err);
    });
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}
