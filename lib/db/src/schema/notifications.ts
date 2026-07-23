import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const notificationTypeEnum = pgEnum("notification_type", [
  "ro_approved",
  "ro_rejected",
  "ro_expiring",
  "invoice_overdue",
  "playout_report_ready",
  "coordinator_absent",
  "invoice_delay",
  "ro_pending_approval",
  "invoice_pending_approval",
  "ro_completed",
  "coordinator_start_reminder",
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").notNull(),
  relatedId: integer("related_id"),
  relatedType: text("related_type"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = typeof notificationsTable.$inferInsert;
export type Notification = typeof notificationsTable.$inferSelect;
