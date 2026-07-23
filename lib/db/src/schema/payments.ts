import { pgTable, serial, text, integer, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const paymentModeEnum = pgEnum("payment_mode", ["upi", "cheque", "bank_transfer", "cash"]);

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMode: paymentModeEnum("payment_mode").notNull(),
  paymentReference: text("payment_reference"),
  paymentDate: text("payment_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = typeof paymentsTable.$inferInsert;
export type Payment = typeof paymentsTable.$inferSelect;
