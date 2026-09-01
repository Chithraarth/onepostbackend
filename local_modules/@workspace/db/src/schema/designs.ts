import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface DesignSettings {
  text: string;
  textColor: string;
  fontSize: number;
  bgColor: string;
  templateId: string | null;
  uploadedImageDataUrl: string | null;
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: number;
}

export const designsTable = pgTable("designs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull(),
  imageDataUrl: text("image_data_url").notNull(),
  format: text("format").notNull().default("custom"),
  settings: jsonb("settings").$type<DesignSettings>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDesignSchema = createInsertSchema(designsTable).omit({
  id: true,
  createdAt: true,
  userId: true,
});
export type InsertDesign = z.infer<typeof insertDesignSchema>;
export type Design = typeof designsTable.$inferSelect;
