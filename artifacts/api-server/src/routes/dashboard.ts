import { Router } from "express";
import { db, type ReleaseOrder, type Invoice, type PlayoutReport } from "@workspace/db";
import {
  releaseOrdersTable, invoicesTable, playoutReportsTable, clientsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sevenDaysStr = sevenDaysLater.toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  const [ros, invs, reports] = await Promise.all([
    db.query.releaseOrdersTable.findMany(),
    db.query.invoicesTable.findMany(),
    db.query.playoutReportsTable.findMany({ where: eq(playoutReportsTable.status, "submitted") }),
  ]);

  const activeROs = ros.filter(r => r.status === "active" || r.status === "approved");
  const pendingApproval = ros.filter(r => r.status === "pending_approval");
  const expiringSoon = ros.filter(r =>
    (r.status === "active" || r.status === "approved") &&
    r.publishTo >= nowStr && r.publishTo <= sevenDaysStr
  );

  const pendingInvs = invs.filter(i => !["paid"].includes(i.status) && ["sent", "partially_paid", "approved"].includes(i.status));
  const overdueInvs = pendingInvs.filter(i => {
    if (!i.sentAt) return false;
    const days = Math.floor((now.getTime() - new Date(i.sentAt).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 30;
  });
  const warningInvs = pendingInvs.filter(i => {
    if (!i.sentAt) return false;
    const days = Math.floor((now.getTime() - new Date(i.sentAt).getTime()) / (1000 * 60 * 60 * 24));
    return days >= 14 && days < 30;
  });

  const totalRevenue = invs.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalOutstanding = pendingInvs.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);

  // Invoices pending generation (playout reports with no matching invoice)
  const invROIds = new Set(invs.map(i => i.releaseOrderId));
  const invoicesPendingGeneration = reports.filter(r => !invROIds.has(r.releaseOrderId)).length;

  // Recent activity (last 10 RO/invoice changes)
  const recentROs = ros.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  const recentInvs = invs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

  const recentActivity = [
    ...recentROs.map(r => ({ id: r.id, description: `RO ${r.roNumber} - ${r.status}`, timestamp: r.updatedAt.toISOString(), type: "release_order" })),
    ...recentInvs.map(i => ({ id: i.id, description: `Invoice ${i.invoiceNumber} - ${i.status}`, timestamp: i.updatedAt.toISOString(), type: "invoice" })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

  res.json({
    totalActiveROs: activeROs.length,
    totalPendingApproval: pendingApproval.length,
    totalExpiringSoon: expiringSoon.length,
    totalInvoicesPending: pendingInvs.length,
    invoicesPendingGeneration,
    totalRevenue,
    totalOutstanding,
    overdueInvoices: overdueInvs.length,
    warningInvoices: warningInvs.length,
    recentActivity,
  });
});

router.get("/dashboard/active-media", requireAuth, async (req, res) => {
  const ros = await db.query.releaseOrdersTable.findMany({
    orderBy: (r, { asc }) => [asc(r.publishTo)],
  });
  const active = ros.filter(r => r.status === "active" || r.status === "approved");

  const clientIds = [...new Set(active.map(r => r.clientId))];
  const clients = clientIds.length
    ? await db.query.clientsTable.findMany({ where: (c: any, { inArray }: any) => inArray(c.id, clientIds) })
    : [];
  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));

  res.json(active.map(r => ({
    ...r,
    clientName: clientMap[r.clientId] || "Unknown",
    agencyName: null,
    ratePerSpot: r.ratePerSpot ? Number(r.ratePerSpot) : null,
    stoppedAt: r.stoppedAt?.toISOString() || null,
    revisionAppliedAt: r.revisionAppliedAt?.toISOString() || null,
    approvedAt: r.approvedAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.get("/dashboard/expiring-soon", requireAuth, async (req, res) => {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nowStr = now.toISOString().split("T")[0];
  const sevenDaysStr = sevenDaysLater.toISOString().split("T")[0];

  const ros = await db.query.releaseOrdersTable.findMany({ orderBy: (r, { asc }) => [asc(r.publishTo)] });
  const expiring = ros.filter(r =>
    (r.status === "active" || r.status === "approved") &&
    r.publishTo >= nowStr && r.publishTo <= sevenDaysStr
  );

  const clientIds = [...new Set(expiring.map(r => r.clientId))];
  const clients = clientIds.length
    ? await db.query.clientsTable.findMany({ where: (c: any, { inArray }: any) => inArray(c.id, clientIds) })
    : [];
  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));

  res.json(expiring.map(r => ({
    ...r,
    clientName: clientMap[r.clientId] || "Unknown",
    agencyName: null,
    ratePerSpot: r.ratePerSpot ? Number(r.ratePerSpot) : null,
    stoppedAt: r.stoppedAt?.toISOString() || null,
    revisionAppliedAt: r.revisionAppliedAt?.toISOString() || null,
    approvedAt: r.approvedAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.get("/dashboard/pending-invoices", requireAuth, async (req, res) => {
  const invs = await db.query.invoicesTable.findMany({ orderBy: (i, { desc }) => [desc(i.sentAt)] });
  const pending = invs.filter(i => ["sent", "partially_paid", "approved"].includes(i.status));

  const clientIds = [...new Set(pending.map(i => i.clientId))];
  const clients = clientIds.length
    ? await db.query.clientsTable.findMany({ where: (c: any, { inArray }: any) => inArray(c.id, clientIds) })
    : [];
  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c]));

  const now = new Date();
  res.json(pending.map(i => {
    const agingDays = i.sentAt ? Math.floor((now.getTime() - new Date(i.sentAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
    const agingStatus = agingDays === null ? null : agingDays >= 30 ? "overdue" : agingDays >= 14 ? "warning" : "normal";
    return {
      ...i,
      clientName: clientMap[i.clientId]?.name || "",
      clientAddress: clientMap[i.clientId]?.address || "",
      clientGst: clientMap[i.clientId]?.gstNumber || null,
      agencyName: null,
      subtotal: Number(i.subtotal),
      totalAmount: Number(i.totalAmount),
      paidAmount: Number(i.paidAmount),
      dueAmount: Number(i.totalAmount) - Number(i.paidAmount),
      cgstAmount: i.cgstAmount ? Number(i.cgstAmount) : null,
      sgstAmount: i.sgstAmount ? Number(i.sgstAmount) : null,
      cgstPercent: Number(i.cgstPercent),
      sgstPercent: Number(i.sgstPercent),
      commissionAmount: i.commissionAmount ? Number(i.commissionAmount) : null,
      agingDays,
      agingStatus,
      sentAt: i.sentAt?.toISOString() || null,
      approvedAt: i.approvedAt?.toISOString() || null,
      paidAt: i.paidAt?.toISOString() || null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    };
  }));
});

export default router;
