import { Router } from "express";
import { db } from "@workspace/db";
import { releaseOrdersTable, clientsTable, agenciesTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and, ilike, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { syncAllReleaseOrders } from "../lib/roSync";

const router = Router();

function toRO(ro: any, clientName: string, agencyName?: string | null) {
  return {
    ...ro,
    clientName,
    agencyName: agencyName || null,
    ratePerDay: ro.ratePerDay ? Number(ro.ratePerDay) : null,
    stoppedAt: ro.stoppedAt?.toISOString() || null,
    revisionAppliedAt: ro.revisionAppliedAt?.toISOString() || null,
    approvedAt: ro.approvedAt?.toISOString() || null,
    createdAt: ro.createdAt.toISOString(),
    updatedAt: ro.updatedAt.toISOString(),
  };
}

async function generateRoNumber(): Promise<string> {
  const count = await db.select({ count: sql<number>`count(*)` }).from(releaseOrdersTable);
  const num = (Number(count[0].count) + 1).toString().padStart(4, "0");
  const now = new Date();
  const year = now.getFullYear();
  return `RO/${year}/${num}`;
}

async function notifyManagement(db: any, message: string, type: string, relatedId: number) {
  const managers = await db.query.usersTable.findMany({
    where: eq(usersTable.role, "management"),
  });
  for (const mgr of managers) {
    await db.insert(notificationsTable).values({ userId: mgr.id, message, type, relatedId, relatedType: "release_order" });
  }
}

router.get("/release-orders", requireAuth, async (req, res) => {
  const { status, clientId, month } = req.query;
  await syncAllReleaseOrders(db);
  const ros = await db.query.releaseOrdersTable.findMany({
    orderBy: (r: any, { desc }: any) => [desc(r.createdAt)],
  });

  let filtered = ros;
  if (status) filtered = filtered.filter((r: any) => r.status === status);
  if (clientId) filtered = filtered.filter((r: any) => r.clientId === Number(clientId));
  if (month && typeof month === "string") {
    filtered = filtered.filter((r: any) => r.publishFrom?.startsWith(month) || r.publishTo?.startsWith(month));
  }

  const clientIds = [...new Set(filtered.map((r: any) => r.clientId))];
  const agencyIds = [...new Set(filtered.map((r: any) => r.agencyId).filter(Boolean))] as number[];

  const clients = clientIds.length
    ? await db.query.clientsTable.findMany({ where: (c: any, { inArray }: any) => inArray(c.id, clientIds) })
    : [];
  const agencies = agencyIds.length
    ? await db.query.agenciesTable.findMany({ where: (a: any, { inArray }: any) => inArray(a.id, agencyIds) })
    : [];

  const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  const agencyMap = Object.fromEntries(agencies.map((a: any) => [a.id, a.name]));

  res.json(filtered.map((r: any) => toRO(r, clientMap[r.clientId] || "Unknown", r.agencyId ? agencyMap[r.agencyId] : null)));
});

router.post("/release-orders", requireAuth, async (req, res) => {
  const { clientId, agencyId, roDate, clientRoReference, publishFrom, publishTo,
    scrollKannada, scrollMarathi, audioVideoKannada, audioVideoMarathi,
    repeatTimes, spotType, spotDuration, ratePerDay, bonusSpots,
    mediaDesignRequired, notes, mediaUrl } = req.body;

  if (!clientId || !publishFrom || !publishTo) {
    res.status(400).json({ error: "clientId, publishFrom, and publishTo are required" });
    return;
  }

  const roNumber = await generateRoNumber();
  const [ro] = await db.insert(releaseOrdersTable).values({
    roNumber, clientId, agencyId, status: "pending_approval", roDate, clientRoReference,
    publishFrom, publishTo,
    scrollKannada: !!scrollKannada, scrollMarathi: !!scrollMarathi,
    audioVideoKannada: !!audioVideoKannada, audioVideoMarathi: !!audioVideoMarathi,
    repeatTimes, spotType, spotDuration,
    ratePerDay: ratePerDay ? String(ratePerDay) : null,
    bonusSpots, mediaDesignRequired: !!mediaDesignRequired, notes, mediaUrl,
    createdBy: req.user!.id,
  }).returning();

  // Notify management that a new RO needs approval
  await notifyManagement(
    db,
    `New Release Order ${roNumber} requires approval`,
    "ro_pending_approval",
    ro.id
  );

  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, clientId) });
  const agency = agencyId ? await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, agencyId) }) : null;

  res.status(201).json(toRO(ro, client?.name || "Unknown", agency?.name));
});

router.get("/release-orders/:id", requireAuth, async (req, res) => {
  await syncAllReleaseOrders(db);
  const ro = await db.query.releaseOrdersTable.findFirst({ where: eq(releaseOrdersTable.id, Number(req.params.id)) });
  if (!ro) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) });
  const agency = ro.agencyId ? await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, ro.agencyId) }) : null;
  res.json(toRO(ro, client?.name || "Unknown", agency?.name));
});

router.patch("/release-orders/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
  if (updates.ratePerDay !== undefined) updates.ratePerDay = String(updates.ratePerDay);
  const [ro] = await db.update(releaseOrdersTable).set(updates).where(eq(releaseOrdersTable.id, id)).returning();
  if (!ro) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) });
  const agency = ro.agencyId ? await db.query.agenciesTable.findFirst({ where: eq(agenciesTable.id, ro.agencyId) }) : null;
  res.json(toRO(ro, client?.name || "Unknown", agency?.name));
});

router.delete("/release-orders/:id", requireAuth, requireRole("management", "operations"), async (req, res) => {
  await db.delete(releaseOrdersTable).where(eq(releaseOrdersTable.id, Number(req.params.id)));
  res.json({ success: true });
});

router.post("/release-orders/:id/approve", requireAuth, requireRole("management"), async (req, res) => {
  const id = Number(req.params.id);
  const [ro] = await db.update(releaseOrdersTable)
    .set({ status: "approved", approvedAt: new Date(), approvedBy: req.user!.id, updatedAt: new Date() })
    .where(eq(releaseOrdersTable.id, id)).returning();
  if (!ro) { res.status(404).json({ error: "Not found" }); return; }
  await syncAllReleaseOrders(db);
  const syncedRo = await db.query.releaseOrdersTable.findFirst({ where: eq(releaseOrdersTable.id, id) });
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) });
  res.json(toRO(syncedRo || ro, client?.name || "Unknown"));
});

router.post("/release-orders/:id/reject", requireAuth, requireRole("management"), async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body;
  const [ro] = await db.update(releaseOrdersTable)
    .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
    .where(eq(releaseOrdersTable.id, id)).returning();
  if (!ro) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) });
  res.json(toRO(ro, client?.name || "Unknown"));
});

router.post("/release-orders/:id/stop", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body;
  const [ro] = await db.update(releaseOrdersTable)
    .set({ status: "stopped", stopReason: reason, stoppedAt: new Date(), updatedAt: new Date() })
    .where(eq(releaseOrdersTable.id, id)).returning();
  if (!ro) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) });
  res.json(toRO(ro, client?.name || "Unknown"));
});

router.post("/release-orders/:id/revise", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { note, publishFrom, publishTo } = req.body;
  const updates: Record<string, unknown> = { revisionNote: note, updatedAt: new Date() };
  if (publishFrom) updates.publishFrom = publishFrom;
  if (publishTo) updates.publishTo = publishTo;
  const [ro] = await db.update(releaseOrdersTable).set(updates).where(eq(releaseOrdersTable.id, id)).returning();
  if (!ro) { res.status(404).json({ error: "Not found" }); return; }
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, ro.clientId) });
  res.json(toRO(ro, client?.name || "Unknown"));
});

export default router;
