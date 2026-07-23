import { useState, useEffect } from "react";
import { useListClients } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ConsolidatedReportItem {
  id: number;
  roNumber: string;
  clientId: number;
  clientName: string;
  roStatus: string;
  publishFrom: string;
  publishTo: string;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  invoiceTotal: number;
  amountPaid: number;
  amountOutstanding: number;
}

export default function Reports() {
  const { data: clients } = useListClients();
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [reportData, setReportData] = useState<ConsolidatedReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>("roNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    let url = "/api/reports/consolidated";
    const params = new URLSearchParams();
    if (selectedClient !== "all") params.append("clientId", selectedClient);
    if (selectedMonth !== "all") params.append("month", selectedMonth);
    if (params.toString()) url += `?${params.toString()}`;

    const token = localStorage.getItem('token');
    fetch(url, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setReportData(data);
        } else {
          setReportData([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedClient, selectedMonth]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const sortedData = [...reportData].sort((a: any, b: any) => {
    let valA = a[sortBy] ?? "";
    let valB = b[sortBy] ?? "";
    
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const getRoStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>;
      case "pending_approval": return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Pending Approval</Badge>;
      case "approved": return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700">Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      case "completed": return <Badge variant="outline">Completed</Badge>;
      case "stopped": return <Badge variant="destructive" className="bg-red-900">Stopped</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getInvStatusBadge = (status: string | null) => {
    if (!status) return <span className="text-muted-foreground text-xs">-</span>;
    switch (status) {
      case "draft": return <Badge variant="outline">Draft</Badge>;
      case "pending_approval": return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Pending Approval</Badge>;
      case "approved": return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700">Approved</Badge>;
      case "sent": return <Badge className="bg-blue-600">Sent</Badge>;
      case "partially_paid": return <Badge className="bg-orange-500 text-white">Partially Paid</Badge>;
      case "paid": return <Badge className="bg-emerald-600 text-white">Paid</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getMonthsList = () => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = format(d, "yyyy-MM");
      const label = format(d, "MMMM yyyy");
      list.push({ val, label });
    }
    return list;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consolidated RO & Payment Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Cross-referenced Release Orders, Invoices, and Payment collections.</p>
        </div>
        <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90">
          <Printer className="mr-2 h-4 w-4" /> Print Report
        </Button>
      </div>

      <div className="hidden print-only mb-6 text-center border-b pb-4">
        <h1 className="text-3xl font-bold">InNews 24x7 - Consolidated Summary Report</h1>
        <p className="text-sm text-muted-foreground mt-1">Generated on {format(new Date(), "dd MMMM yyyy, hh:mm a")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Filters: Client: {selectedClient === "all" ? "All Clients" : clients?.find(c => c.id === Number(selectedClient))?.name} | Month: {selectedMonth === "all" ? "All Months" : selectedMonth}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 no-print">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Client</label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="all">All Clients</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="all">All Months</option>
            {getMonthsList().map((m) => (
              <option key={m.val} value={m.val}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead onClick={() => handleSort("roNumber")} className="cursor-pointer hover:bg-muted/80">
                  RO Number {sortBy === "roNumber" && (sortOrder === "asc" ? "▲" : "▼")}
                </TableHead>
                <TableHead onClick={() => handleSort("clientName")} className="cursor-pointer hover:bg-muted/80">
                  Client {sortBy === "clientName" && (sortOrder === "asc" ? "▲" : "▼")}
                </TableHead>
                <TableHead onClick={() => handleSort("roStatus")} className="cursor-pointer hover:bg-muted/80">
                  RO Status {sortBy === "roStatus" && (sortOrder === "asc" ? "▲" : "▼")}
                </TableHead>
                <TableHead onClick={() => handleSort("invoiceNumber")} className="cursor-pointer hover:bg-muted/80">
                  Invoice {sortBy === "invoiceNumber" && (sortOrder === "asc" ? "▲" : "▼")}
                </TableHead>
                <TableHead onClick={() => handleSort("invoiceStatus")} className="cursor-pointer hover:bg-muted/80">
                  Invoice Status {sortBy === "invoiceStatus" && (sortOrder === "asc" ? "▲" : "▼")}
                </TableHead>
                <TableHead onClick={() => handleSort("invoiceTotal")} className="text-right cursor-pointer hover:bg-muted/80">
                  Total {sortBy === "invoiceTotal" && (sortOrder === "asc" ? "▲" : "▼")}
                </TableHead>
                <TableHead onClick={() => handleSort("amountPaid")} className="text-right cursor-pointer hover:bg-muted/80">
                  Paid {sortBy === "amountPaid" && (sortOrder === "asc" ? "▲" : "▼")}
                </TableHead>
                <TableHead onClick={() => handleSort("amountOutstanding")} className="text-right cursor-pointer hover:bg-muted/80">
                  Outstanding {sortBy === "amountOutstanding" && (sortOrder === "asc" ? "▲" : "▼")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(8).fill(0).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-full"></div></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    No records found matching filters.
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono font-medium">{item.roNumber}</TableCell>
                    <TableCell className="font-medium">{item.clientName}</TableCell>
                    <TableCell>{getRoStatusBadge(item.roStatus)}</TableCell>
                    <TableCell className="font-mono">{item.invoiceNumber || <span className="text-muted-foreground text-xs">Uninvoiced</span>}</TableCell>
                    <TableCell>{getInvStatusBadge(item.invoiceStatus)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(item.invoiceTotal)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600 font-medium">{formatCurrency(item.amountPaid)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive font-medium">{formatCurrency(item.amountOutstanding)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
