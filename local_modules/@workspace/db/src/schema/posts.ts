import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  caption: text("caption").notNull(),
  imageUrl: text("image_url"),
  platforms: text("platforms").array().notNull().default([]),
  status: text("status").notNull().default("draft"),
  contentTypes: text("content_types").array().notNull().default([]),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sharedAt: timestamp("shared_at", { withTimezone: true }),
  metrics: jsonb("metrics")
    .$type<{ platform: string; likes: number; views: number }[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
