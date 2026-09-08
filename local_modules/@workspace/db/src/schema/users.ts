import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  // Firebase Auth uid
  id: text("id").primaryKey(),
  email: text("email"),
  // "none" = no active subscription, "trial" = free month, "active" = paid
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  subscriptionEndsAt: timestamp("subscription_ends_at", {
    withTimezone: true,
  }),
  freeMonthClaimed: boolean("free_month_claimed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
