import { Router } from "express";
import { db } from "@workspace/db";
import { agenciesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

router.get("/agencies", requireAuth, async (req, res) => {
  const agencies = await db.query.agenciesTable.findMany({ orderBy: (a: any, { asc }: any) => [asc(a.name)] });
  res.json(agencies.map((a: any) => ({ ...a, commissionPercent: Number(a.commissionPercent) })));
});

router.post("/agencies", requireAuth, requireRole("management", "operations"), async (req, res) => {
  const { name, type, contactPerson, phone, email, commissionPercent } = req.body;
  if (!name || !type) {
    res.status(400).json({ error: "name and type are required" });
    return;
  }
  const [agency] = await db.insert(agenciesTable).values({
    name, type, contactPerson, phone, email,
    commissionPercent: String(commissionPercent || 0),
  }).returning();
  res.status(201).json({ ...agency, commissionPercent: Number(agency.commissionPercent) });
});

router.patch("/agencies/:id", requireAuth, requireRole("management", "operations"), async (req, res) => {
  const id = Number(req.params.id);
  const updates: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
  if (updates.commissionPercent !== undefined) updates.commissionPercent = String(updates.commissionPercent);
  const [agency] = await db.update(agenciesTable).set(updates).where(eq(agenciesTable.id, id)).returning();
  if (!agency) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...agency, commissionPercent: Number(agency.commissionPercent) });
});

router.delete("/agencies/:id", requireAuth, requireRole("management", "operations"), async (req, res) => {
  await db.delete(agenciesTable).where(eq(agenciesTable.id, Number(req.params.id)));
  res.json({ success: true });
});

export default router;
