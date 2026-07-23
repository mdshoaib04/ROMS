import { releaseOrdersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    }
  }
}
