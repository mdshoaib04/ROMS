import { pgTable, serial, text, integer, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "partially_paid",
  "paid",
]);

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: integer("client_id").notNull(),
  releaseOrderId: integer("release_order_id").notNull(),
  playoutReportId: integer("playout_report_id"),
  agencyId: integer("agency_id"),
  roReference: text("ro_reference"),
  publishFrom: text("publish_from").notNull(),
  publishTo: text("publish_to").notNull(),
  scrollKannadaDays: integer("scroll_kannada_days"),
  scrollKannadaRate: numeric("scroll_kannada_rate", { precision: 10, scale: 2 }),
  scrollMarathiDays: integer("scroll_marathi_days"),
  scrollMarathiRate: numeric("scroll_marathi_rate", { precision: 10, scale: 2 }),
  videoKannadaDays: integer("video_kannada_days"),
  videoKannadaRate: numeric("video_kannada_rate", { precision: 10, scale: 2 }),
  videoMarathiDays: integer("video_marathi_days"),
  videoMarathiRate: numeric("video_marathi_rate", { precision: 10, scale: 2 }),
  videoCreativeCharges: numeric("video_creative_charges", { precision: 10, scale: 2 }),
  includeGst: boolean("include_gst").notNull().default(true),
  cgstPercent: numeric("cgst_percent", { precision: 5, scale: 2 }).notNull().default("9"),
  sgstPercent: numeric("sgst_percent", { precision: 5, scale: 2 }).notNull().default("9"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 12, scale: 2 }),
  sgstAmount: numeric("sgst_amount", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  invoiceNumber: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
