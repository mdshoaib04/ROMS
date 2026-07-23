import { Router } from "express";
import { db } from "@workspace/db";
import { releaseOrdersTable, invoicesTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { syncAllReleaseOrders } from "../lib/roSync";

const router = Router();

router.get("/reports/consolidated", requireAuth, requireRole("management", "operations"), async (req, res) => {
  const { clientId, month } = req.query;
  await syncAllReleaseOrders(db);

  // Fetch all ROs, invoices, and clients
  const [ros, invoices, clients] = await Promise.all([
    db.query.releaseOrdersTable.findMany({
      orderBy: (r: any, { desc }: any) => [desc(r.createdAt)],
    }),
    db.query.invoicesTable.findMany(),
    db.query.clientsTable.findMany(),
  ]);

  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  
  // Group invoices by releaseOrderId
  const invoiceMap = new Map<number, any>();
  for (const inv of invoices) {
    // If multiple, keep the latest one or approved/sent one
    const existing = invoiceMap.get(inv.releaseOrderId);
    if (!existing || inv.createdAt > existing.createdAt) {
      invoiceMap.set(inv.releaseOrderId, inv);
    }
  }

  let result = ros.map((ro: any) => {
    const inv = invoiceMap.get(ro.id);
    const invoiceTotal = inv ? Number(inv.totalAmount) : 0;
    const amountPaid = inv ? Number(inv.paidAmount) : 0;
    const amountOutstanding = inv ? invoiceTotal - amountPaid : 0;

    return {
      id: ro.id,
      roNumber: ro.roNumber,
      clientId: ro.clientId,
      clientName: clientMap[ro.clientId] || "Unknown",
      roStatus: ro.status,
      publishFrom: ro.publishFrom,
      publishTo: ro.publishTo,
      invoiceNumber: inv ? inv.invoiceNumber : null,
      invoiceStatus: inv ? inv.status : null,
      invoiceTotal,
      amountPaid,
      amountOutstanding,
    };
  });

  // Apply filters
  if (clientId) {
    const cid = Number(clientId);
    result = result.filter((item: any) => item.clientId === cid);
  }
  if (month && typeof month === "string") {
    result = result.filter((item: any) => item.publishFrom.startsWith(month) || item.publishTo.startsWith(month));
  }

  res.json(result);
});

export default router;
