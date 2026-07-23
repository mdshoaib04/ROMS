import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const playoutReportStatusEnum = pgEnum("playout_report_status", ["draft", "submitted", "invoiced"]);

export const playoutReportsTable = pgTable("playout_reports", {
  id: serial("id").primaryKey(),
  releaseOrderId: integer("release_order_id").notNull(),
  reportDate: text("report_date").notNull(),
  publishFrom: text("publish_from"),
  publishTo: text("publish_to"),
  totalSpotsScheduled: integer("total_spots_scheduled").notNull().default(0),
  totalSpotsAired: integer("total_spots_aired").notNull().default(0),
  scrollKannadaDays: integer("scroll_kannada_days"),
  scrollMarathiDays: integer("scroll_marathi_days"),
  videoKannadaDays: integer("video_kannada_days"),
  videoMarathiDays: integer("video_marathi_days"),
  discrepancyNote: text("discrepancy_note"),
  screenshotUrl: text("screenshot_url"),
  status: playoutReportStatusEnum("status").notNull().default("draft"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlayoutReportSchema = createInsertSchema(playoutReportsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlayoutReport = typeof playoutReportsTable.$inferInsert;
export type PlayoutReport = typeof playoutReportsTable.$inferSelect;
