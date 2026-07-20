import { useGetInvoice, getGetInvoiceQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ChevronLeft, Printer, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

export default function InvoiceDetail({ id }: { id: string }) {
  const invoiceId = parseInt(id);
  const { data: invoice, isLoading } = useGetInvoice(invoiceId, {
    query: { enabled: !!invoiceId, queryKey: getGetInvoiceQueryKey(invoiceId) }
  });

  const handlePrint = () => window.print();

  if (isLoading || !invoice) return <div className="p-8 text-center animate-pulse">Loading invoice...</div>;

  const toWords = (num: number) => {
    // Simple placeholder for number to words
    return "Rupees " + num.toLocaleString() + " Only";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Controls - Hidden on print */}
      <div className="flex justify-between items-center gap-4 border-b pb-6 no-print">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/invoices"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
            <Badge variant="outline" className="mt-1">{invoice.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* PRINTABLE INVOICE AREA */}
      <div className="bg-white text-black p-8 md:p-12 border border-zinc-200 shadow-sm print:border-none print:shadow-none print:p-0 mx-auto font-sans">
        
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-extrabold tracking-widest uppercase">INVOICE</h1>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          {/* From */}
          <div>
            <p className="font-bold text-base mb-1">From:</p>
            <p className="font-bold text-primary">News 27 Media Networks / InNews 24x7</p>
            <p>CTS No. 4824/A6, MB Square, Fourth Floor</p>
            <p>Flat No. 403, Old SP Office Road</p>
            <p>Ayodhya Nagar, Belagavi, KA-590 010</p>
            <p className="mt-2"><span className="font-semibold">GSTIN:</span> 29AAPFN6292A1ZY</p>
          </div>
          
          {/* Meta & Bank */}
          <div className="text-right">
            <div className="mb-4">
              <p><span className="font-semibold">Invoice No:</span> {invoice.invoiceNumber}</p>
              <p><span className="font-semibold">Date:</span> {format(new Date(invoice.createdAt), "dd-MMM-yyyy")}</p>
              <p><span className="font-semibold">RO Ref:</span> {invoice.roReference || "N/A"}</p>
            </div>
            <div className="bg-zinc-50 p-3 rounded text-left border border-zinc-200">
              <p className="font-bold text-xs uppercase text-zinc-500 mb-1">Bank Details</p>
              <p><span className="font-semibold">Bank:</span> Union Bank</p>
              <p><span className="font-semibold">A/C Name:</span> News 27 Media Networks</p>
              <p><span className="font-semibold">A/C No:</span> 074411100001857</p>
              <p><span className="font-semibold">IFSC:</span> UBIN0900591</p>
            </div>
          </div>
        </div>

        {/* To */}
        <div className="mb-8 p-4 border border-zinc-200 rounded">
          <p className="font-bold text-base mb-1">To:</p>
          <p className="font-bold">{invoice.clientName}</p>
          <p className="whitespace-pre-wrap">{invoice.clientAddress || "Address not provided"}</p>
          <p className="mt-2"><span className="font-semibold">GSTIN:</span> {invoice.clientGst || "Unregistered"}</p>
        </div>

        <div className="mb-4 text-sm">
          <span className="font-bold">Telecast Duration: </span> 
          {invoice.publishFrom ? format(new Date(invoice.publishFrom), "dd-MMM-yyyy") : "-"} to {invoice.publishTo ? format(new Date(invoice.publishTo), "dd-MMM-yyyy") : "-"}
        </div>

        {/* Line Items Table */}
        <table className="w-full mb-8 text-sm border-collapse border border-black">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-black p-2 text-left w-12">No.</th>
              <th className="border border-black p-2 text-left">Description</th>
              <th className="border border-black p-2 text-center w-24">Qty (Days)</th>
              <th className="border border-black p-2 text-right w-32">Rate (₹)</th>
              <th className="border border-black p-2 text-right w-36">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {[
              { desc: "Scroll Kannada", days: invoice.scrollKannadaDays, rate: invoice.scrollKannadaRate },
              { desc: "Scroll Marathi", days: invoice.scrollMarathiDays, rate: invoice.scrollMarathiRate },
              { desc: "Video Kannada", days: invoice.videoKannadaDays, rate: invoice.videoKannadaRate },
              { desc: "Video Marathi", days: invoice.videoMarathiDays, rate: invoice.videoMarathiRate },
            ].map((item, i) => {
              if (!item.days || item.days <= 0) return null;
              return (
                <tr key={item.desc}>
                  <td className="border border-black p-2 text-center">{i + 1}</td>
                  <td className="border border-black p-2">{item.desc}</td>
                  <td className="border border-black p-2 text-center">{item.days}</td>
                  <td className="border border-black p-2 text-right">{item.rate?.toLocaleString()}</td>
                  <td className="border border-black p-2 text-right">{((item.days || 0) * (item.rate || 0)).toLocaleString()}</td>
                </tr>
              );
            })}
            
            {invoice.videoCreativeCharges ? (
              <tr>
                <td className="border border-black p-2 text-center">-</td>
                <td className="border border-black p-2">Video Creative Charges</td>
                <td className="border border-black p-2 text-center">1</td>
                <td className="border border-black p-2 text-right">{invoice.videoCreativeCharges.toLocaleString()}</td>
                <td className="border border-black p-2 text-right">{invoice.videoCreativeCharges.toLocaleString()}</td>
              </tr>
            ) : null}

            {/* Empty rows to fill space if needed */}
            <tr>
              <td className="border-l border-r border-black p-2 h-8"></td>
              <td className="border-l border-r border-black p-2 h-8"></td>
              <td className="border-l border-r border-black p-2 h-8"></td>
              <td className="border-l border-r border-black p-2 h-8"></td>
              <td className="border-l border-r border-black p-2 h-8"></td>
            </tr>

            {/* Totals */}
            <tr>
              <td colSpan={3} className="border border-black p-2 border-r-0"></td>
              <td className="border border-black p-2 text-right font-bold border-l-0">Subtotal</td>
              <td className="border border-black p-2 text-right font-bold">{invoice.subtotal?.toLocaleString()}</td>
            </tr>
            {invoice.cgstAmount ? (
              <tr>
                <td colSpan={3} className="border border-black p-2 border-r-0"></td>
                <td className="border border-black p-2 text-right border-l-0">CGST @ 9%</td>
                <td className="border border-black p-2 text-right">{invoice.cgstAmount.toLocaleString()}</td>
              </tr>
            ) : null}
            {invoice.sgstAmount ? (
              <tr>
                <td colSpan={3} className="border border-black p-2 border-r-0"></td>
                <td className="border border-black p-2 text-right border-l-0">SGST @ 9%</td>
                <td className="border border-black p-2 text-right">{invoice.sgstAmount.toLocaleString()}</td>
              </tr>
            ) : null}
            <tr className="bg-zinc-100">
              <td colSpan={3} className="border border-black p-2 border-r-0">
                <span className="text-xs text-zinc-600">Amount in words:</span><br/>
                <span className="font-semibold capitalize">{toWords(invoice.totalAmount)}</span>
              </td>
              <td className="border border-black p-2 text-right font-bold border-l-0 text-lg">Total ₹</td>
              <td className="border border-black p-2 text-right font-bold text-lg">{invoice.totalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer / Terms */}
        <div className="flex justify-between items-end mt-16 text-sm">
          <div className="w-1/2">
            <p className="font-bold underline mb-2">Terms & Conditions:</p>
            <ol className="list-decimal pl-4 text-xs space-y-1">
              <li>Subject to Belagavi Jurisdiction.</li>
              <li>Payment to be made within 15 days of invoice.</li>
              <li>Cheque/DD should be in favor of "News 27 Media Networks".</li>
            </ol>
          </div>
          <div className="text-center w-1/3">
            <p className="font-bold mb-12">For News 27 Media Networks</p>
            <p className="border-t border-black pt-1">(Mr. Rajashekar Patil)</p>
            <p className="text-xs text-zinc-600">Authorized Signatory</p>
          </div>
        </div>

      </div>

    </div>
  );
}
