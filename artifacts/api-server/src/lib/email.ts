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

export async function sendInvoiceEmail(invoice: any, client: any, pdfBuffer: Buffer) {
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
      }
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
