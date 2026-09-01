import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, postsTable, contactsTable } from "@workspace/db";
import {
  ListPostsQueryParams,
  ListPostsResponse,
  CreatePostBody,
  CreatePostResponse,
  GetPostParams,
  GetPostResponse,
  UpdatePostParams,
  UpdatePostBody,
  UpdatePostResponse,
  DeletePostParams,
  SharePostParams,
  SharePostBody,
  SharePostResponse,
  UpdatePostMetricsParams,
  UpdatePostMetricsBody,
  UpdatePostMetricsResponse,
  SendPostParams,
  SendPostBody,
  SendPostResponse,
} from "@workspace/api-zod";
import { isEmailConfigured, sendEmail } from "../lib/email";
import { serializeDates } from "../lib/serialize";
import { claimObjectOwnership } from "./storage";

const router: IRouter = Router();

/**
 * A "scheduled" post must carry a valid (and on creation, future) timestamp,
 * otherwise the scheduler can never publish it. Returns the parsed Date (or
 * null when not scheduling) or a 400-worthy error message.
 */
function validateSchedule(
  status: string | undefined,
  scheduledAt: string | null | undefined,
  { requireFuture }: { requireFuture: boolean },
): { date: Date | null } | { error: string } {
  if (status === "scheduled") {
    if (!scheduledAt) {
      return { error: "A scheduled post requires scheduledAt" };
    }
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) {
      return { error: "scheduledAt must be a valid date" };
    }
    if (requireFuture && date <= new Date()) {
      return { error: "scheduledAt must be in the future" };
    }
    return { date };
  }
  if (scheduledAt) {
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) {
      return { error: "scheduledAt must be a valid date" };
    }
    return { date };
  }
  return { date: null };
}

router.get("/posts", async (req, res): Promise<void> => {
  const query = ListPostsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = query.data.status
    ? await db
        .select()
        .from(postsTable)
        .where(
          and(
            eq(postsTable.status, query.data.status),
            eq(postsTable.userId, req.userId!),
          ),
        )
        .orderBy(desc(postsTable.createdAt))
    : await db
        .select()
        .from(postsTable)
        .where(eq(postsTable.userId, req.userId!))
        .orderBy(desc(postsTable.createdAt));

  res.json(ListPostsResponse.parse(serializeDates(rows)));
});

router.post("/posts", async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { scheduledAt, ...rest } = parsed.data;
  const scheduled = validateSchedule(rest.status, scheduledAt, {
    requireFuture: true,
  });
  if ("error" in scheduled) {
    res.status(400).json({ error: scheduled.error });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({
      ...rest,
      userId: req.userId!,
      scheduledAt: scheduled.date,
    })
    .returning();

  await claimObjectOwnership(post.imageUrl, req.userId!, req.log);

  res.status(201).json(CreatePostResponse.parse(serializeDates(post)));
});

router.get("/posts/:id", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.userId, req.userId!)));

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json(GetPostResponse.parse(serializeDates(post)));
});

router.patch("/posts/:id", async (req, res): Promise<void> => {
  const params = UpdatePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { scheduledAt, ...rest } = parsed.data;
  if (rest.status === "scheduled" || scheduledAt !== undefined) {
    if (rest.status !== "scheduled") {
      // Changing scheduledAt without scheduling is fine only when clearing it.
      if (scheduledAt) {
        const d = new Date(scheduledAt);
        if (Number.isNaN(d.getTime())) {
          res.status(400).json({ error: "scheduledAt must be a valid date" });
          return;
        }
      }
    } else {
      const scheduled = validateSchedule("scheduled", scheduledAt ?? null, {
        requireFuture: false,
      });
      if ("error" in scheduled) {
        res.status(400).json({ error: scheduled.error });
        return;
      }
    }
  }

  const [post] = await db
    .update(postsTable)
    .set({
      ...rest,
      ...(scheduledAt !== undefined
        ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
        : {}),
    })
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.userId, req.userId!)))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  await claimObjectOwnership(post.imageUrl, req.userId!, req.log);

  res.json(UpdatePostResponse.parse(serializeDates(post)));
});

router.delete("/posts/:id", async (req, res): Promise<void> => {
  const params = DeletePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [post] = await db
    .delete(postsTable)
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.userId, req.userId!)))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/posts/:id/send", async (req, res): Promise<void> => {
  const params = SendPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [post] = await db
    .select()
    .from(postsTable)
    .where(
      and(eq(postsTable.id, params.data.id), eq(postsTable.userId, req.userId!)),
    );
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(501).json({
      error:
        "Email sending is not set up yet. Connect an email provider to send posts to your contacts.",
    });
    return;
  }

  const contacts = await db
    .select()
    .from(contactsTable)
    .where(
      and(
        inArray(contactsTable.id, parsed.data.contactIds),
        eq(contactsTable.userId, req.userId!),
      ),
    );

  const sent: string[] = [];
  const failed: string[] = [];
  for (const contact of contacts) {
    if (!contact.email) {
      failed.push(contact.name);
      continue;
    }
    try {
      await sendEmail({
        to: contact.email,
        subject: parsed.data.subject ?? "A post for you",
        text: parsed.data.message
          ? `${parsed.data.message}\n\n${post.caption}`
          : post.caption,
        imageUrl: post.imageUrl,
      });
      sent.push(contact.name);
    } catch (err) {
      req.log.warn({ err, contactId: contact.id }, "Failed to send email");
      failed.push(contact.name);
    }
  }

  res.json(SendPostResponse.parse({ sent, failed }));
});

router.post("/posts/:id/share", async (req, res): Promise<void> => {
  const params = SharePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SharePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [post] = await db
    .update(postsTable)
    .set({
      status: "shared",
      platforms: parsed.data.platforms,
      sharedAt: new Date(),
      ...(parsed.data.contentTypes !== undefined
        ? { contentTypes: parsed.data.contentTypes }
        : {}),
    })
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.userId, req.userId!)))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json(SharePostResponse.parse(serializeDates(post)));
});

router.put("/posts/:id/metrics", async (req, res): Promise<void> => {
  const params = UpdatePostMetricsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePostMetricsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.userId, req.userId!)));

  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  if (existing.status !== "shared") {
    res
      .status(400)
      .json({ error: "Metrics can only be recorded for shared posts" });
    return;
  }

  const metricPlatforms = parsed.data.metrics.map((m) => m.platform);
  if (new Set(metricPlatforms).size !== metricPlatforms.length) {
    res.status(400).json({ error: "Duplicate platform in metrics" });
    return;
  }
  const invalid = metricPlatforms.filter(
    (p) => !existing.platforms.includes(p)
  );
  if (invalid.length > 0) {
    res.status(400).json({
      error: `Metrics include platforms this post was not shared to: ${invalid.join(", ")}`,
    });
    return;
  }
  if (
    parsed.data.metrics.some(
      (m) => !Number.isInteger(m.likes) || !Number.isInteger(m.views)
    )
  ) {
    res.status(400).json({ error: "Likes and views must be whole numbers" });
    return;
  }

  const [post] = await db
    .update(postsTable)
    .set({ metrics: parsed.data.metrics })
    .where(and(eq(postsTable.id, params.data.id), eq(postsTable.userId, req.userId!)))
    .returning();

  res.json(UpdatePostMetricsResponse.parse(serializeDates(post)));
});

export default router;
