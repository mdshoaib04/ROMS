import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, clientsTable, agenciesTable, releaseOrdersTable, notificationsTable, usersTable, playoutReportsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { generateInvoicePdf, sendInvoiceEmail, generatePlayoutReportPdf } from "../lib/email";
import { runPaymentReminderEmails } from "../lib/onDemandChecks";


const router = Router();

async function notifyManagement(db: any, message: string, type: string, relatedId: number) {
  const managers = await db.query.usersTable.findMany({
    where: eq(usersTable.role, "management"),
  });
  for (const mgr of managers) {
    await db.insert(notificationsTable).values({ userId: mgr.id, message, type, relatedId, relatedType: "invoice" });
  }
}

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
    lastReminderSentAt: inv.lastReminderSentAt?.toISOString() || null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

router.get("/invoices", requireAuth, async (req, res) => {
  const { status, clientId, month } = req.query;
  if (req.user && (req.user.role === "management" || req.user.role === "operations")) {
    await runPaymentReminderEmails(db);
  }
  let invs = await db.query.invoicesTable.findMany({ orderBy: (i: any, { desc }: any) => [desc(i.createdAt)] });

  if (status) invs = invs.filter((i: any) => i.status === status);
  if (clientId) invs = invs.filter((i: any) => i.clientId === Number(clientId));
  if (month && typeof month === "string") {
    invs = invs.filter((i: any) => i.publishFrom?.startsWith(month) || i.publishTo?.startsWith(month));
  }

  const clientIds = [...new Set(invs.map((i: any) => i.clientId))];
  const clients = clientIds.length
    ? await db.query.clientsTable.findMany({ where: (c: any, { inArray }: any) => inArray(c.id, clientIds) })
    : [];
  const agencyIds = [...new Set(invs.map((i: any) => i.agencyId).filter(Boolean))] as number[];
  const agencies = agencyIds.length
    ? await db.query.agenciesTable.findMany({ where: (a: any, { inArray }: any) => inArray(a.id, agencyIds) })
    : [];

  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c]));
  const agencyMap = Object.fromEntries(agencies.map((a: any) => [a.id, a.name]));

  res.json(invs.map((i: any) => toInvoice(i, clientMap[i.clientId]?.name || "", clientMap[i.clientId]?.address || "", clientMap[i.clientId]?.gstNumber || null, i.agencyId ? agencyMap[i.agencyId] : null)));
});

router.post("/invoices", requireAuth, requireRole("operations", "management"), async (req, res) => {
  const playoutReportId = Number(req.body.playoutReportId);
  const pr = await db.query.playoutReportsTable.findFirst({ where: eq(playoutReportsTable.id, playoutReportId) });
  if (!pr) {
    res.status(400).json({ error: "Invalid playoutReportId" });
    return;
  }
  const ro = await db.query.releaseOrdersTable.findFirst({ where: eq(releaseOrdersTable.id, pr.releaseOrderId) });
  const roRate = ro?.ratePerDay ? Number(ro.ratePerDay) : 0;

  const clientId = req.body.clientId || ro?.clientId || pr.clientId;
  const releaseOrderId = req.body.releaseOrderId || pr.releaseOrderId;
  const publishFrom = req.body.publishFrom || pr.publishFrom;
  const publishTo = req.body.publishTo || pr.publishTo;

  const scrollKannadaDays = req.body.scrollKannadaDays !== undefined ? Number(req.body.scrollKannadaDays) : (pr.scrollKannadaDays || 0);
  const scrollMarathiDays = req.body.scrollMarathiDays !== undefined ? Number(req.body.scrollMarathiDays) : (pr.scrollMarathiDays || 0);
  const videoKannadaDays = req.body.videoKannadaDays !== undefined ? Number(req.body.videoKannadaDays) : (pr.videoKannadaDays || 0);
  const videoMarathiDays = req.body.videoMarathiDays !== undefined ? Number(req.body.videoMarathiDays) : (pr.videoMarathiDays || 0);

  const scrollKannadaRate = req.body.scrollKannadaRate !== undefined ? Number(req.body.scrollKannadaRate) : (ro?.scrollKannada ? roRate : 0);
  const scrollMarathiRate = req.body.scrollMarathiRate !== undefined ? Number(req.body.scrollMarathiRate) : (ro?.scrollMarathi ? roRate : 0);
  const videoKannadaRate = req.body.videoKannadaRate !== undefined ? Number(req.body.videoKannadaRate) : (ro?.audioVideoKannada ? roRate : 0);
  const videoMarathiRate = req.body.videoMarathiRate !== undefined ? Number(req.body.videoMarathiRate) : (ro?.audioVideoMarathi ? roRate : 0);

  const videoCreativeCharges = req.body.videoCreativeCharges !== undefined ? Number(req.body.videoCreativeCharges) : 0;
  const includeGst = req.body.includeGst !== false;

  const bodyForTotals = {
    scrollKannadaDays, scrollKannadaRate,
    scrollMarathiDays, scrollMarathiRate,
    videoKannadaDays, videoKannadaRate,
    videoMarathiDays, videoMarathiRate,
    videoCreativeCharges,
    includeGst,
    cgstPercent: req.body.cgstPercent,
    sgstPercent: req.body.sgstPercent
  };

  const invoiceNumber = await generateInvoiceNumber();
  const { subtotal, cgstAmount, sgstAmount, totalAmount } = calcTotals(bodyForTotals);

  // calc commission if agency present
  let commissionAmount = null;
  const agencyId = req.body.agencyId || ro?.agencyId || null;
  if (agencyId) {
    const agency = await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, agencyId) });
    if (agency) commissionAmount = (totalAmount * Number(agency.commissionPercent)) / 100;
  }

  const [inv] = await db.insert(invoicesTable).values({
    invoiceNumber,
    clientId,
    releaseOrderId,
    playoutReportId,
    agencyId,
    roReference: req.body.roReference || ro?.clientRoReference || ro?.roNumber,
    publishFrom,
    publishTo,
    scrollKannadaDays,
    scrollKannadaRate: String(scrollKannadaRate),
    scrollMarathiDays,
    scrollMarathiRate: String(scrollMarathiRate),
    videoKannadaDays,
    videoKannadaRate: String(videoKannadaRate),
    videoMarathiDays,
    videoMarathiRate: String(videoMarathiRate),
    videoCreativeCharges: String(videoCreativeCharges),
    includeGst,
    cgstPercent: String(req.body.cgstPercent || 9),
    sgstPercent: String(req.body.sgstPercent || 9),
    subtotal: String(subtotal),
    cgstAmount: String(cgstAmount),
    sgstAmount: String(sgstAmount),
    totalAmount: String(totalAmount),
    paidAmount: "0",
    commissionAmount: commissionAmount ? String(commissionAmount) : null,
    status: "draft",
    invoiceDate: req.body.invoiceDate || null,
    createdBy: req.user!.id,
  }).returning();

  // Notify management that a new invoice draft needs approval
  await notifyManagement(
    db,
    `New Invoice Draft ${invoiceNumber} requires approval`,
    "invoice_pending_approval",
    inv.id
  );

  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, clientId) });
  const agency = agencyId ? await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, agencyId) }) : null;

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
  const inv = await db.query.invoicesTable.findFirst({ where: eq(invoicesTable.id, id) });
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, inv.clientId) });
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  try {
    const pdfBuffer = await generateInvoicePdf(inv, client);
    let playoutReportPdfBuffer = null;
    if (inv.playoutReportId) {
      const report = await db.query.playoutReportsTable.findFirst({ where: eq(playoutReportsTable.id, inv.playoutReportId) });
      const ro = await db.query.releaseOrdersTable.findFirst({ where: eq(releaseOrdersTable.id, inv.releaseOrderId) });
      if (report) {
        playoutReportPdfBuffer = await generatePlayoutReportPdf(report, ro);
      }
    }
    await sendInvoiceEmail(inv, client, pdfBuffer, playoutReportPdfBuffer);
  } catch (err: any) {
    console.error("Email send failure:", err);
    res.status(500).json({ error: `Failed to deliver invoice email to ${client.email || 'client'}: ${err.message || 'SMTP connection error'}` });
    return;
  }

  const [updatedInv] = await db.update(invoicesTable).set({ status: "sent", sentAt: new Date(), updatedAt: new Date() }).where(eq(invoicesTable.id, id)).returning();
  res.json(toInvoice(updatedInv, client.name, client.address, client.gstNumber));
});

export default router;
