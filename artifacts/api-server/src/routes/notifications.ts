import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const { unread } = req.query;
  let notifs = await db.query.notificationsTable.findMany({
    where: eq(notificationsTable.userId, req.user!.id),
    orderBy: (n: any, { desc }: any) => [desc(n.createdAt)],
  });
  if (unread === "true") notifs = notifs.filter((n: any) => !n.isRead);
  res.json(notifs.map((n: any) => ({ ...n, createdAt: n.createdAt.toISOString() })));
});

router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(notificationsTable).set({ isRead: true }).where(
    and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.id))
  );
  res.json({ success: true });
});

export default router;
