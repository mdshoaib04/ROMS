import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/clients", requireAuth, async (req, res) => {
  const { search } = req.query;
  let clients;
  if (search && typeof search === "string") {
    clients = await db.query.clientsTable.findMany({
      where: or(ilike(clientsTable.name, `%${search}%`), ilike(clientsTable.phone, `%${search}%`)),
      orderBy: (c: any, { asc }: any) => [asc(c.name)],
    });
  } else {
    clients = await db.query.clientsTable.findMany({ orderBy: (c: any, { asc }: any) => [asc(c.name)] });
  }
  res.json(clients);
});

router.post("/clients", requireAuth, async (req, res) => {
  const { name, contactPerson, address, phone, email, gstNumber, notes } = req.body;
  if (!name || !address || !phone) {
    res.status(400).json({ error: "name, address, and phone are required" });
    return;
  }
  const [client] = await db.insert(clientsTable).values({ name, contactPerson, address, phone, email, gstNumber, notes }).returning();
  res.status(201).json(client);
});

router.get("/clients/:id", requireAuth, async (req, res) => {
  const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, Number(req.params.id)) });
  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client);
});

router.patch("/clients/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const updates = { ...req.body, updatedAt: new Date() };
  const [client] = await db.update(clientsTable).set(updates).where(eq(clientsTable.id, id)).returning();
  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client);
});

router.delete("/clients/:id", requireAuth, async (req, res) => {
  await db.delete(clientsTable).where(eq(clientsTable.id, Number(req.params.id)));
  res.json({ success: true });
});

export default router;
