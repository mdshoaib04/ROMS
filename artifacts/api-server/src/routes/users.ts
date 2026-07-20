import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, hashPassword } from "../lib/auth";

const router = Router();

router.get("/users", requireAuth, requireRole("management"), async (req, res) => {
  const users = await db.query.usersTable.findMany({ orderBy: (u, { desc }) => [desc(u.createdAt)] });
  res.json(users.map(({ passwordHash: _, ...u }) => u));
});

router.post("/users", requireAuth, requireRole("management"), async (req, res) => {
  const { username, name, email, role, phone, password } = req.body;
  if (!username || !name || !email || !role || !password) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({ username, name, email, role, phone, passwordHash }).returning();
  const { passwordHash: _, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.get("/users/:id", requireAuth, requireRole("management"), async (req, res) => {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, Number(req.params.id)) });
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

router.patch("/users/:id", requireAuth, requireRole("management"), async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role, phone, isActive, password } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (phone !== undefined) updates.phone = phone;
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) updates.passwordHash = hashPassword(password);
  updates.updatedAt = new Date();
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

router.delete("/users/:id", requireAuth, requireRole("management"), async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  res.json({ success: true });
});

export default router;
