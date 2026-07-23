import { Router } from "express";
import { db } from "@workspace/db";
import { paymentsTable, invoicesTable, clientsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { runPaymentReminderEmails } from "../lib/onDemandChecks";

const router = Router();

router.get("/payments", requireAuth, async (req, res) => {
  const { invoiceId, clientId } = req.query;
  if (req.user && (req.user.role === "management" || req.user.role === "operations")) {
    await runPaymentReminderEmails(db);
  }
  let payments = await db.query.paymentsTable.findMany({ orderBy: (p: any, { desc }: any) => [desc(p.createdAt)] });

  if (invoiceId) payments = payments.filter((p: any) => p.invoiceId === Number(invoiceId));

  const invIds = [...new Set(payments.map((p: any) => p.invoiceId))];
  const invs = invIds.length
    ? await db.query.invoicesTable.findMany({ where: (i: any, { inArray }: any) => inArray(i.id, invIds) })
    : [];
  const clientIds = [...new Set(invs.map((i: any) => i.clientId))];
  const clients = clientIds.length
    ? await db.query.clientsTable.findMany({ where: (c: any, { inArray }: any) => inArray(c.id, clientIds) })
    : [];

  const invMap = Object.fromEntries(invs.map((i: any) => [i.id, i]));
  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));

  let result = payments.map((p: any) => ({
    ...p,
    amount: Number(p.amount),
    invoiceNumber: invMap[p.invoiceId]?.invoiceNumber || "",
    clientName: clientMap[invMap[p.invoiceId]?.clientId] || "",
    createdAt: p.createdAt.toISOString(),
  }));

  if (clientId) {
    const cid = Number(clientId);
    result = result.filter((p: any) => invMap[p.invoiceId]?.clientId === cid);
  }

  res.json(result);
});

router.post("/payments", requireAuth, requireRole("operations", "management"), async (req, res) => {
  const { invoiceId, amount, paymentMode, paymentReference, paymentDate, notes } = req.body;
  if (!invoiceId || !amount || !paymentMode || !paymentDate) {
    res.status(400).json({ error: "invoiceId, amount, paymentMode, and paymentDate are required" });
    return;
  }

  const inv = await db.query.invoicesTable.findFirst({ where: eq(invoicesTable.id, invoiceId) });
  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (inv.status === "draft") {
    res.status(400).json({ error: "Cannot record payment against a draft invoice — invoice must be approved and sent first" });
    return;
  }

  const [payment] = await db.insert(paymentsTable).values({
    invoiceId, amount: String(amount), paymentMode, paymentReference, paymentDate, notes,
  }).returning();

  // Update invoice paid amount and status
  const newPaid = Number(inv.paidAmount) + Number(amount);
  const total = Number(inv.totalAmount);
  const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partially_paid" : inv.status;
  const paidAt = newPaid >= total ? new Date() : inv.paidAt;
  await db.update(invoicesTable).set({
    paidAmount: String(newPaid),
    status: newStatus as any,
    paidAt,
    updatedAt: new Date(),
  }).where(eq(invoicesTable.id, invoiceId));

  const updatedInv = await db.query.invoicesTable.findFirst({ where: eq(invoicesTable.id, invoiceId) });
  const client = updatedInv ? await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, updatedInv.clientId) }) : null;

  res.status(201).json({
    ...payment,
    amount: Number(payment.amount),
    invoiceNumber: updatedInv?.invoiceNumber || "",
    clientName: client?.name || "",
    createdAt: payment.createdAt.toISOString(),
  });
});

export default router;
