import { db } from "@workspace/db";
import { releaseOrdersTable, playoutReportsTable, invoicesTable, notificationsTable, usersTable, clientsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { generateInvoicePdf, generatePlayoutReportPdf, sendPaymentReminderEmail } from "./email";

function getLocalDbTime(date: any): number {
  if (!date) return 0;
  const d = new Date(date);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  ).getTime();
}

export async function runManagementOnDemandChecks(dbConn: any) {
  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();

  // Get managers
  const managers = await dbConn.query.usersTable.findMany({
    where: eq(usersTable.role, "management"),
  });
  if (managers.length === 0) return;

  // 1. Missed Start Date Check:
  // Find pending_approval ROs where publishFrom <= today
  const pendingROs = await dbConn.query.releaseOrdersTable.findMany({
    where: eq(releaseOrdersTable.status, "pending_approval"),
  });

  for (const ro of pendingROs) {
    if (todayStr >= ro.publishFrom) {
      for (const mgr of managers) {
        // Check for existing unread notification of same type for this RO and user
        const existing = await dbConn.query.notificationsTable.findFirst({
          where: and(
            eq(notificationsTable.userId, mgr.id),
            eq(notificationsTable.relatedId, ro.id),
            eq(notificationsTable.relatedType, "release_order"),
            eq(notificationsTable.isRead, false),
            sql`message LIKE '%was due to start on%'`
          ),
        });
        if (!existing) {
          await dbConn.insert(notificationsTable).values({
            userId: mgr.id,
            message: `RO ${ro.roNumber} was due to start on ${ro.publishFrom} but is still pending approval`,
            type: "ro_pending_approval",
            relatedId: ro.id,
            relatedType: "release_order",
            isRead: false,
          });
        }
      }
    }
  }

  // 2. Coordinator Absence Check:
  // Find completed ROs with no playout report filed 48+ hours after publishTo
  const completedROs = await dbConn.query.releaseOrdersTable.findMany({
    where: eq(releaseOrdersTable.status, "completed"),
  });

  const playoutReports = await dbConn.query.playoutReportsTable.findMany({
    where: eq(playoutReportsTable.status, "submitted"),
  });
  const playoutRoIds = new Set(playoutReports.map((pr: any) => pr.releaseOrderId));

  const COORDINATOR_ABSENT_MS = process.env.COORDINATOR_ABSENT_THRESHOLD_MS 
    ? parseInt(process.env.COORDINATOR_ABSENT_THRESHOLD_MS, 10) 
    : 48 * 60 * 60 * 1000; // 48 hours

  for (const ro of completedROs) {
    if (!playoutRoIds.has(ro.id)) {
      const publishToEndDate = new Date(ro.publishTo + "T23:59:59");
      const elapsedMs = now.getTime() - publishToEndDate.getTime();
      if (elapsedMs >= COORDINATOR_ABSENT_MS) {
        for (const mgr of managers) {
          const existing = await dbConn.query.notificationsTable.findFirst({
            where: and(
              eq(notificationsTable.userId, mgr.id),
              eq(notificationsTable.relatedId, ro.id),
              eq(notificationsTable.relatedType, "release_order"),
              eq(notificationsTable.isRead, false),
              eq(notificationsTable.type, "coordinator_absent")
            ),
          });
          if (!existing) {
            await dbConn.insert(notificationsTable).values({
              userId: mgr.id,
              message: `No playout report has been filed for RO ${ro.roNumber} more than 48 hours after completion — coordinator action may be needed.`,
              type: "coordinator_absent",
              relatedId: ro.id,
              relatedType: "release_order",
              isRead: false,
            });
          }
        }
      }
    }
  }

  // 3. Invoice Delay Check:
  // Playout report submitted over 24 hours ago, and no invoice generated that references it
  const invoices = await dbConn.query.invoicesTable.findMany();
  const playoutReportInvoiceIds = new Set(invoices.map((inv: any) => inv.playoutReportId).filter(Boolean));

  const INVOICE_DELAY_MS = process.env.INVOICE_DELAY_THRESHOLD_MS 
    ? parseInt(process.env.INVOICE_DELAY_THRESHOLD_MS, 10) 
    : 24 * 60 * 60 * 1000; // 24 hours

  for (const pr of playoutReports) {
    if (!playoutReportInvoiceIds.has(pr.id)) {
      const elapsedMs = now.getTime() - getLocalDbTime(pr.createdAt);
      if (elapsedMs >= INVOICE_DELAY_MS) {
        const ro = await dbConn.query.releaseOrdersTable.findFirst({
          where: eq(releaseOrdersTable.id, pr.releaseOrderId),
        });
        const roNumber = ro ? ro.roNumber : "Unknown";

        for (const mgr of managers) {
          const existing = await dbConn.query.notificationsTable.findFirst({
            where: and(
              eq(notificationsTable.userId, mgr.id),
              eq(notificationsTable.relatedId, pr.id),
              eq(notificationsTable.relatedType, "playout_report"),
              eq(notificationsTable.isRead, false),
              eq(notificationsTable.type, "invoice_delay")
            ),
          });
          if (!existing) {
            await dbConn.insert(notificationsTable).values({
              userId: mgr.id,
              message: `Playout report PR-${pr.id} for RO ${roNumber} was submitted over 24 hours ago with no invoice generated yet.`,
              type: "invoice_delay",
              relatedId: pr.id,
              relatedType: "playout_report",
              isRead: false,
            });
          }
        }
      }
    }
  }
}

export async function runPaymentReminderEmails(dbConn: any) {
  const now = new Date();
  
  // Find invoices that are sent or partially_paid
  const invoices = await dbConn.query.invoicesTable.findMany({
    where: (i: any, { inArray }: any) => inArray(i.status, ["sent", "partially_paid"]),
  });

  const REMINDER_THRESHOLD_MS = process.env.PAYMENT_REMINDER_THRESHOLD_MS 
    ? parseInt(process.env.PAYMENT_REMINDER_THRESHOLD_MS, 10) 
    : 14 * 24 * 60 * 60 * 1000; // 14 days

  const REPEAT_REMINDER_MS = process.env.PAYMENT_REMINDER_REPEAT_MS 
    ? parseInt(process.env.PAYMENT_REMINDER_REPEAT_MS, 10) 
    : 7 * 24 * 60 * 60 * 1000; // 7 days

  for (const inv of invoices) {
    if (!inv.sentAt) continue;

    const timeSinceSent = now.getTime() - getLocalDbTime(inv.sentAt);
    if (timeSinceSent >= REMINDER_THRESHOLD_MS) {
      let shouldSend = false;
      if (!inv.lastReminderSentAt) {
        shouldSend = true;
      } else {
        const timeSinceLastReminder = now.getTime() - getLocalDbTime(inv.lastReminderSentAt);
        if (timeSinceLastReminder >= REPEAT_REMINDER_MS) {
          shouldSend = true;
        }
      }

      if (shouldSend) {
        const client = await dbConn.query.clientsTable.findFirst({
          where: eq(clientsTable.id, inv.clientId),
        });
        if (client) {
          try {
            const pdfBuffer = await generateInvoicePdf(inv, client);
            let playoutReportPdfBuffer = null;
            if (inv.playoutReportId) {
              const report = await dbConn.query.playoutReportsTable.findFirst({
                where: eq(playoutReportsTable.id, inv.playoutReportId),
              });
              const ro = await dbConn.query.releaseOrdersTable.findFirst({
                where: eq(releaseOrdersTable.id, inv.releaseOrderId),
              });
              if (report) {
                playoutReportPdfBuffer = await generatePlayoutReportPdf(report, ro);
              }
            }

            await sendPaymentReminderEmail(inv, client, pdfBuffer, playoutReportPdfBuffer);
            
            await dbConn.update(invoicesTable)
              .set({ lastReminderSentAt: new Date(), updatedAt: new Date() })
              .where(eq(invoicesTable.id, inv.id));
              
            console.log(`[Reminder System] Sent payment reminder for Invoice ${inv.invoiceNumber}`);
          } catch (err) {
            console.error(`[Reminder System] Failed to send payment reminder for Invoice ${inv.invoiceNumber}:`, err);
          }
        }
      }
    }
  }
}
