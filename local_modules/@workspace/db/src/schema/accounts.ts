import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  platform: text("platform").notNull(),
  displayName: text("display_name").notNull(),
  handle: text("handle").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
