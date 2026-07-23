import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

export function generateInvoicePdf(invoice: any, client: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fontSize(20).text("INNEWS INVOICE", { align: "center" });
      doc.moveDown();

      // Invoice details
      doc.fontSize(10).text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.text(`Period: ${invoice.publishFrom} to ${invoice.publishTo}`);
      doc.moveDown();

      // Client details
      doc.text(`Bill To:`);
      doc.text(`${client.name}`);
      doc.text(`${client.address}`);
      if (client.gstNumber) doc.text(`GSTIN: ${client.gstNumber}`);
      doc.moveDown();

      // Line items table header
      doc.text("--------------------------------------------------------------------------------", { align: "center" });
      doc.text("Description                  Qty (Days)        Rate/Day (₹)        Amount (₹)");
      doc.text("--------------------------------------------------------------------------------", { align: "center" });

      // Table rows
      const items = [
        { name: "Scroll Kannada", days: invoice.scrollKannadaDays, rate: invoice.scrollKannadaRate },
        { name: "Scroll Marathi", days: invoice.scrollMarathiDays, rate: invoice.scrollMarathiRate },
        { name: "Video Kannada", days: invoice.videoKannadaDays, rate: invoice.videoKannadaRate },
        { name: "Video Marathi", days: invoice.videoMarathiDays, rate: invoice.videoMarathiRate },
      ];

      for (const item of items) {
        if (item.days && item.rate && Number(item.days) > 0 && Number(item.rate) > 0) {
          const amt = Number(item.days) * Number(item.rate);
          doc.text(
            `${item.name.padEnd(28)}${String(item.days).padEnd(18)}${String(item.rate).padEnd(20)}${amt.toFixed(2)}`
          );
        }
      }

      if (invoice.videoCreativeCharges && Number(invoice.videoCreativeCharges) > 0) {
        doc.text(
          `Creative Charges${"".padEnd(40)}${Number(invoice.videoCreativeCharges).toFixed(2)}`
        );
      }

      doc.text("--------------------------------------------------------------------------------", { align: "center" });
      doc.moveDown();

      // Totals
      doc.text(`Subtotal: ₹${Number(invoice.subtotal).toFixed(2)}`, { align: "right" });
      if (invoice.includeGst) {
        doc.text(`CGST (${invoice.cgstPercent}%): ₹${Number(invoice.cgstAmount).toFixed(2)}`, { align: "right" });
        doc.text(`SGST (${invoice.sgstPercent}%): ₹${Number(invoice.sgstAmount).toFixed(2)}`, { align: "right" });
      }
      doc.text(`Total Amount: ₹${Number(invoice.totalAmount).toFixed(2)}`, { align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export function generatePlayoutReportPdf(report: any, ro: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fontSize(20).text("PLAYOUT REPORT", { align: "center" });
      doc.moveDown();

      // Report details
      doc.fontSize(10).text(`Report Date: ${report.reportDate}`);
      doc.text(`Release Order Number: ${ro ? ro.roNumber : 'N/A'}`);
      doc.text(`Playout Period: ${report.publishFrom || 'N/A'} to ${report.publishTo || 'N/A'}`);
      doc.moveDown();

      // Spots summary
      doc.text(`Total Spots Scheduled: ${report.totalSpotsScheduled}`);
      doc.text(`Total Spots Aired: ${report.totalSpotsAired}`);
      
      const variance = report.totalSpotsScheduled > 0 
        ? ((report.totalSpotsAired - report.totalSpotsScheduled) / report.totalSpotsScheduled) * 100 
        : 0;
      doc.text(`Variance: ${variance.toFixed(1)}%`);
      doc.moveDown();

      // Per-language days breakdown
      doc.text("--------------------------------------------------------------------------------", { align: "center" });
      doc.text("Media Type                   Language            Days Run");
      doc.text("--------------------------------------------------------------------------------", { align: "center" });

      if (report.scrollKannadaDays && report.scrollKannadaDays > 0) {
        doc.text(`Scroll                       Kannada             ${report.scrollKannadaDays}`);
      }
      if (report.scrollMarathiDays && report.scrollMarathiDays > 0) {
        doc.text(`Scroll                       Marathi             ${report.scrollMarathiDays}`);
      }
      if (report.videoKannadaDays && report.videoKannadaDays > 0) {
        doc.text(`Video (AV)                   Kannada             ${report.videoKannadaDays}`);
      }
      if (report.videoMarathiDays && report.videoMarathiDays > 0) {
        doc.text(`Video (AV)                   Marathi             ${report.videoMarathiDays}`);
      }
      doc.text("--------------------------------------------------------------------------------", { align: "center" });
      doc.moveDown();

      if (report.discrepancyNote) {
        doc.text("Discrepancy Notes:");
        doc.text(report.discrepancyNote);
        doc.moveDown();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function sendInvoiceEmail(invoice: any, client: any, pdfBuffer: Buffer, playoutReportPdfBuffer?: Buffer | null) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"InNews ROMS" <billing@innews.com>';

  let transporter;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } else {
    console.log("SMTP environment variables not configured. Creating Ethereal test account...");
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const to = client.email || "recipient@example.com";
  
  const mailOptions = {
    from,
    to,
    subject: `Invoice ${invoice.invoiceNumber} from InNews`,
    text: `Hello ${client.contactPerson || client.name || "Client"},\n\nPlease find attached the invoice ${invoice.invoiceNumber} for the publish period of ${invoice.publishFrom} to ${invoice.publishTo}.\n\nTotal Amount Due: ₹${Number(invoice.totalAmount).toLocaleString()}\n\nRegards,\nInNews ROMS billing team`,
    attachments: [
      {
        filename: `Invoice_${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      },
      ...(playoutReportPdfBuffer ? [{
        filename: `Playout_Report_${invoice.invoiceNumber}.pdf`,
        content: playoutReportPdfBuffer,
        contentType: 'application/pdf'
      }] : [])
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Email sent successfully: messageId=${info.messageId}`);
  
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Test Mail Preview URL: ${previewUrl}`);
  }
  
  return { messageId: info.messageId, previewUrl };
}

export async function sendPaymentReminderEmail(invoice: any, client: any, pdfBuffer: Buffer, playoutReportPdfBuffer?: Buffer | null) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"InNews ROMS" <billing@innews.com>';

  let transporter;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } else {
    console.log("SMTP environment variables not configured for reminder. Creating Ethereal test account...");
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const to = client.email || "recipient@example.com";
  const outstandingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  
  const mailOptions = {
    from,
    to,
    subject: `Payment Reminder: Invoice ${invoice.invoiceNumber} from InNews`,
    text: `Hello ${client.contactPerson || client.name || "Client"},\n\nThis is a friendly reminder that payment for Invoice ${invoice.invoiceNumber} is outstanding.\n\nTotal Amount Due: ₹${Number(invoice.totalAmount).toLocaleString()}\nOutstanding Amount: ₹${outstandingAmount.toLocaleString()}\n\nPlease find the invoice attached.\n\nRegards,\nInNews ROMS billing team`,
    attachments: [
      {
        filename: `Invoice_${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      },
      ...(playoutReportPdfBuffer ? [{
        filename: `Playout_Report_${invoice.invoiceNumber}.pdf`,
        content: playoutReportPdfBuffer,
        contentType: 'application/pdf'
      }] : [])
    ]
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Reminder email sent successfully: messageId=${info.messageId}`);
  
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Reminder Mail Preview URL: ${previewUrl}`);
  }
  
  return { messageId: info.messageId, previewUrl };
}
