import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, clientsTable, agenciesTable, releaseOrdersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

function getFinancialYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
}

async function generateInvoiceNumber(): Promise<string> {
  const fy = getFinancialYear();
  const count = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable);
  const num = (Number(count[0].count) + 1).toString().padStart(3, "0");
  return `IN/${fy}/${num}`;
}

function calcTotals(body: any) {
  const scrollKannada = (body.scrollKannadaDays || 0) * (body.scrollKannadaRate || 0);
  const scrollMarathi = (body.scrollMarathiDays || 0) * (body.scrollMarathiRate || 0);
  const videoKannada = (body.videoKannadaDays || 0) * (body.videoKannadaRate || 0);
  const videoMarathi = (body.videoMarathiDays || 0) * (body.videoMarathiRate || 0);
  const creative = body.videoCreativeCharges || 0;
  const subtotal = scrollKannada + scrollMarathi + videoKannada + videoMarathi + creative;
  const cgstPct = body.cgstPercent || 9;
  const sgstPct = body.sgstPercent || 9;
  const cgstAmount = body.includeGst ? (subtotal * cgstPct) / 100 : 0;
  const sgstAmount = body.includeGst ? (subtotal * sgstPct) / 100 : 0;
  const total = subtotal + cgstAmount + sgstAmount;
  return { subtotal, cgstAmount, sgstAmount, totalAmount: total };
}

function toInvoice(inv: any, clientName: string, clientAddress: string, clientGst: string | null, agencyName?: string | null) {
  const agingDays = inv.sentAt ? Math.floor((Date.now() - new Date(inv.sentAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const agingStatus = agingDays === null ? null : agingDays >= 30 ? "overdue" : agingDays >= 14 ? "warning" : "normal";
  return {
    ...inv,
    clientName,
    clientAddress,
    clientGst,
    agencyName: agencyName || null,
    subtotal: Number(inv.subtotal),
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    dueAmount: Number(inv.totalAmount) - Number(inv.paidAmount),
    cgstAmount: inv.cgstAmount ? Number(inv.cgstAmount) : null,
    sgstAmount: inv.sgstAmount ? Number(inv.sgstAmount) : null,
    cgstPercent: Number(inv.cgstPercent),
    sgstPercent: Number(inv.sgstPercent),
    commissionAmount: inv.commissionAmount ? Number(inv.commissionAmount) : null,
    agingDays,
    agingStatus,
    sentAt: inv.sentAt?.toISOString() || null,
    approvedAt: inv.approvedAt?.toISOString() || null,
    paidAt: inv.paidAt?.toISOString() || null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

router.get("/invoices", requireAuth, async (req, res) => {
  const { status, clientId, month } = req.query;
  let invs = await db.query.invoicesTable.findMany({ orderBy: (i, { desc }) => [desc(i.createdAt)] });

  if (status) invs = invs.filter(i => i.status === status);
  if (clientId) invs = invs.filter(i => i.clientId === Number(clientId));
  if (month && typeof month === "string") {
    invs = invs.filter(i => i.publishFrom?.startsWith(month) || i.publishTo?.startsWith(month));
  }

  const clientIds = [...new Set(invs.map(i => i.clientId))];
  const clients = clientIds.length
    ? await db.query.clientsTable.findMany({ where: (c: any, { inArray }: any) => inArray(c.id, clientIds) })
    : [];
  const agencyIds = [...new Set(invs.map(i => i.agencyId).filter(Boolean))] as number[];
  const agencies = agencyIds.length
    ? await db.query.agenciesTable.findMany({ where: (a: any, { inArray }: any) => inArray(a.id, agencyIds) })
    : [];

  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c]));
  const agencyMap = Object.fromEntries(agencies.map((a: any) => [a.id, a.name]));

  res.json(invs.map(i => toInvoice(i, clientMap[i.clientId]?.name || "", clientMap[i.clientId]?.address || "", clientMap[i.clientId]?.gstNumber || null, i.agencyId ? agencyMap[i.agencyId] : null)));
});

router.post("/invoices", requireAuth, requireRole("operations"), async (req, res) => {
  const invoiceNumber = await generateInvoiceNumber();
  const { subtotal, cgstAmount, sgstAmount, totalAmount } = calcTotals(req.body);

  // calc commission if agency present
  let commissionAmount = null;
  if (req.body.agencyId) {
    const agency = await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, req.body.agencyId) });
    if (agency) commissionAmount = (totalAmount * Number(agency.commissionPercent)) / 100;
  }

  const ro = req.body.releaseOrderId
    ? await db.query.releaseOrdersTable.findFirst({ where: eq(releaseOrdersTable.id, req.body.releaseOrderId) })
    : null;

  const [inv] = await db.insert(invoicesTable).values({
    invoiceNumber,
    clientId: req.body.clientId,
    releaseOrderId: req.body.releaseOrderId,
    playoutReportId: req.body.playoutReportId || null,
    agencyId: req.body.agencyId || null,
    roReference: req.body.roReference || ro?.clientRoReference || ro?.roNumber,
    publishFrom: req.body.publishFrom,
    publishTo: req.body.publishTo,
    scrollKannadaDays: req.body.scrollKannadaDays || null,
    scrollKannadaRate: req.body.scrollKannadaRate ? String(req.body.scrollKannadaRate) : null,
    scrollMarathiDays: req.body.scrollMarathiDays || null,
    scrollMarathiRate: req.body.scrollMarathiRate ? String(req.body.scrollMarathiRate) : null,
    videoKannadaDays: req.body.videoKannadaDays || null,
    videoKannadaRate: req.body.videoKannadaRate ? String(req.body.videoKannadaRate) : null,
    videoMarathiDays: req.body.videoMarathiDays || null,
    videoMarathiRate: req.body.videoMarathiRate ? String(req.body.videoMarathiRate) : null,
    videoCreativeCharges: req.body.videoCreativeCharges ? String(req.body.videoCreativeCharges) : null,
    includeGst: req.body.includeGst !== false,
    cgstPercent: String(req.body.cgstPercent || 9),
    sgstPercent: String(req.body.sgstPercent || 9),
    subtotal: String(subtotal),
    cgstAmount: String(cgstAmount),
    sgstAmount: String(sgstAmount),
    totalAmount: String(totalAmount),
    paidAmount: "0",
    commissionAmount: commissionAmount ? String(commissionAmount) : null,
    status: "draft",
    createdBy: req.user!.id,
  }).returning();

  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, req.body.clientId) });
  const agency = req.body.agencyId ? await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, req.body.agencyId) }) : null;

  res.status(201).json(toInvoice(inv, client?.name || "", client?.address || "", client?.gstNumber || null, agency?.name));
});

router.get("/invoices/:id", requireAuth, async (req, res) => {
  const inv = await db.query.invoicesTable.findFirst({ where: eq(invoicesTable.id, Number(req.params.id)) });
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, inv.clientId) });
  const agency = inv.agencyId ? await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, inv.agencyId) }) : null;
  res.json(toInvoice(inv, client?.name || "", client?.address || "", client?.gstNumber || null, agency?.name));
});

router.patch("/invoices/:id", requireAuth, requireRole("operations"), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  const { subtotal, cgstAmount, sgstAmount, totalAmount } = calcTotals({ ...(await db.query.invoicesTable.findFirst({ where: eq(invoicesTable.id, id) })), ...body });
  const updates: Record<string, unknown> = { ...body, subtotal: String(subtotal), cgstAmount: String(cgstAmount), sgstAmount: String(sgstAmount), totalAmount: String(totalAmount), updatedAt: new Date() };
  for (const k of ["scrollKannadaRate","scrollMarathiRate","videoKannadaRate","videoMarathiRate","videoCreativeCharges","cgstPercent","sgstPercent"]) {
    if (updates[k] !== undefined) updates[k] = String(updates[k]);
  }
  const [inv] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, inv.clientId) });
  const agency = inv.agencyId ? await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, inv.agencyId) }) : null;
  res.json(toInvoice(inv, client?.name || "", client?.address || "", client?.gstNumber || null, agency?.name));
});

router.post("/invoices/:id/approve", requireAuth, requireRole("management"), async (req, res) => {
  const id = Number(req.params.id);
  const [inv] = await db.update(invoicesTable).set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() }).where(eq(invoicesTable.id, id)).returning();
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, inv.clientId) });
  res.json(toInvoice(inv, client?.name || "", client?.address || "", client?.gstNumber || null));
});

router.post("/invoices/:id/send", requireAuth, requireRole("operations"), async (req, res) => {
  const id = Number(req.params.id);
  const [inv] = await db.update(invoicesTable).set({ status: "sent", sentAt: new Date(), updatedAt: new Date() }).where(eq(invoicesTable.id, id)).returning();
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, inv.clientId) });
  res.json(toInvoice(inv, client?.name || "", client?.address || "", client?.gstNumber || null));
});

export default router;
