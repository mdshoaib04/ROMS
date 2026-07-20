import { Router } from "express";
import { db } from "@workspace/db";
import { playoutReportsTable, releaseOrdersTable, clientsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

function toReport(r: any, roNumber: string, clientName: string) {
  return {
    ...r,
    roNumber,
    clientName,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/playout-reports", requireAuth, async (req, res) => {
  const { releaseOrderId, month } = req.query;
  const reports = await db.query.playoutReportsTable.findMany({
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  let filtered = reports;
  if (releaseOrderId) filtered = filtered.filter(r => r.releaseOrderId === Number(releaseOrderId));
  if (month && typeof month === "string") {
    filtered = filtered.filter(r => r.reportDate?.startsWith(month));
  }

  const roIds = [...new Set(filtered.map(r => r.releaseOrderId))];
  const ros = roIds.length
    ? await db.query.releaseOrdersTable.findMany({ where: (ro: any, { inArray }: any) => inArray(ro.id, roIds) })
    : [];
  const clientIds = [...new Set(ros.map((r: any) => r.clientId))];
  const clients = clientIds.length
    ? await db.query.clientsTable.findMany({ where: (c: any, { inArray }: any) => inArray(c.id, clientIds) })
    : [];

  const roMap = Object.fromEntries(ros.map((r: any) => [r.id, r]));
  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));

  res.json(filtered.map(r => toReport(r, roMap[r.releaseOrderId]?.roNumber || "", clientMap[roMap[r.releaseOrderId]?.clientId] || "")));
});

router.post("/playout-reports", requireAuth, requireRole("coordinator"), async (req, res) => {
  const { releaseOrderId, reportDate, publishFrom, publishTo, totalSpotsScheduled, totalSpotsAired,
    scrollKannadaDays, scrollMarathiDays, videoKannadaDays, videoMarathiDays, discrepancyNote, screenshotUrl } = req.body;

  if (!releaseOrderId || !reportDate) {
    res.status(400).json({ error: "releaseOrderId and reportDate are required" });
    return;
  }

  const [report] = await db.insert(playoutReportsTable).values({
    releaseOrderId, reportDate, publishFrom, publishTo,
    totalSpotsScheduled: totalSpotsScheduled || 0,
    totalSpotsAired: totalSpotsAired || 0,
    scrollKannadaDays, scrollMarathiDays, videoKannadaDays, videoMarathiDays,
    discrepancyNote, screenshotUrl,
    status: "submitted",
    createdBy: req.user!.id,
  }).returning();

  const ro = await db.query.releaseOrdersTable.findFirst({ where: eq(releaseOrdersTable.id, releaseOrderId) });
  const client = ro ? await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) }) : null;

  res.status(201).json(toReport(report, ro?.roNumber || "", client?.name || ""));
});

router.get("/playout-reports/:id", requireAuth, async (req, res) => {
  const report = await db.query.playoutReportsTable.findFirst({ where: eq(playoutReportsTable.id, Number(req.params.id)) });
  if (!report) { res.status(404).json({ error: "Not found" }); return; }
  const ro = await db.query.releaseOrdersTable.findFirst({ where: eq(releaseOrdersTable.id, report.releaseOrderId) });
  const client = ro ? await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) }) : null;
  res.json(toReport(report, ro?.roNumber || "", client?.name || ""));
});

router.patch("/playout-reports/:id", requireAuth, requireRole("coordinator"), async (req, res) => {
  const id = Number(req.params.id);
  const updates = { ...req.body, updatedAt: new Date() };
  const [report] = await db.update(playoutReportsTable).set(updates).where(eq(playoutReportsTable.id, id)).returning();
  if (!report) { res.status(404).json({ error: "Not found" }); return; }
  const ro = await db.query.releaseOrdersTable.findFirst({ where: eq(releaseOrdersTable.id, report.releaseOrderId) });
  const client = ro ? await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) }) : null;
  res.json(toReport(report, ro?.roNumber || "", client?.name || ""));
});

export default router;
