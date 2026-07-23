import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { runManagementOnDemandChecks, runCoordinatorOnDemandChecks } from "../lib/onDemandChecks";

const router = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const { unread } = req.query;
  if (req.user) {
    if (req.user.role === "management") {
      await runManagementOnDemandChecks(db);
    }
    if (req.user.role === "coordinator") {
      await runCoordinatorOnDemandChecks(db);
    }
  }
  let notifs = await db.query.notificationsTable.findMany({
    where: eq(notificationsTable.userId, req.user!.id),
    orderBy: (n: any, { desc }: any) => [desc(n.createdAt)],
  });
  if (unread === "true") notifs = notifs.filter((n: any) => !n.isRead);
  res.json(notifs);
});

router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(notificationsTable).set({ isRead: true }).where(
    and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.id))
  );
  res.json({ success: true });
});

export default router;
