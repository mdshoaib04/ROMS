import { releaseOrdersTable, notificationsTable, usersTable, clientsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function syncAllReleaseOrders(db: any) {
  const today = getTodayString();
  
  // Find all ROs that are approved, active, or completed
  const ros = await db.query.releaseOrdersTable.findMany({
    where: (r: any, { inArray }: any) => inArray(r.status, ["approved", "active", "completed"]),
  });

  for (const ro of ros) {
    let computedStatus = ro.status;
    if (today < ro.publishFrom) {
      computedStatus = "approved";
    } else if (today >= ro.publishFrom && today <= ro.publishTo) {
      computedStatus = "active";
    } else if (today > ro.publishTo) {
      computedStatus = "completed";
    }

    if (computedStatus !== ro.status) {
      await db
        .update(releaseOrdersTable)
        .set({ status: computedStatus, updatedAt: new Date() })
        .where(eq(releaseOrdersTable.id, ro.id));

      if (computedStatus === "completed") {
        const staff = await db.query.usersTable.findMany({
          where: (u: any, { inArray }: any) => inArray(u.role, ["coordinator", "operations"]),
        });
        const client = await db.query.clientsTable.findFirst({
          where: eq(clientsTable.id, ro.clientId)
        });
        const clientName = client?.name || "Unknown";
        for (const user of staff) {
          const existing = await db.query.notificationsTable.findFirst({
            where: and(
              eq(notificationsTable.userId, user.id),
              eq(notificationsTable.relatedId, ro.id),
              eq(notificationsTable.relatedType, "release_order"),
              eq(notificationsTable.isRead, false),
              sql`message LIKE '%has reached its end date%'`
            )
          });
          if (!existing) {
            await db.insert(notificationsTable).values({
              userId: user.id,
              message: `RO ${ro.roNumber} for ${clientName} has reached its end date — confirm playout has stopped and file the playout report.`,
              type: "ro_completed",
              relatedId: ro.id,
              relatedType: "release_order",
              isRead: false,
            });
          }
        }
      }
    }
  }
}
