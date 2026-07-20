import { pgTable, serial, text, boolean, integer, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roStatusEnum = pgEnum("ro_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "active",
  "completed",
  "stopped",
]);

export const releaseOrdersTable = pgTable("release_orders", {
  id: serial("id").primaryKey(),
  roNumber: text("ro_number").notNull().unique(),
  clientId: integer("client_id").notNull(),
  agencyId: integer("agency_id"),
  status: roStatusEnum("status").notNull().default("draft"),
  roDate: text("ro_date"),
  clientRoReference: text("client_ro_reference"),
  publishFrom: text("publish_from").notNull(),
  publishTo: text("publish_to").notNull(),
  scrollKannada: boolean("scroll_kannada").notNull().default(false),
  scrollMarathi: boolean("scroll_marathi").notNull().default(false),
  audioVideoKannada: boolean("audio_video_kannada").notNull().default(false),
  audioVideoMarathi: boolean("audio_video_marathi").notNull().default(false),
  repeatTimes: integer("repeat_times"),
  spotType: text("spot_type"),
  spotDuration: text("spot_duration"),
  ratePerSpot: numeric("rate_per_spot", { precision: 10, scale: 2 }),
  bonusSpots: integer("bonus_spots"),
  mediaDesignRequired: boolean("media_design_required").notNull().default(false),
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  stopReason: text("stop_reason"),
  stoppedAt: timestamp("stopped_at"),
  mediaUrl: text("media_url"),
  revisionNote: text("revision_note"),
  revisionAppliedAt: timestamp("revision_applied_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReleaseOrderSchema = createInsertSchema(releaseOrdersTable).omit({
  id: true,
  roNumber: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReleaseOrder = z.infer<typeof insertReleaseOrderSchema>;
export type ReleaseOrder = typeof releaseOrdersTable.$inferSelect;
