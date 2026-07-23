import { useState } from "react";
import { Link } from "wouter";
import { useListInvoices } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Plus, Search, Eye, Download, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";

export default function Invoices() {
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const { data: invoices, isLoading } = useListInvoices();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="outline">Draft</Badge>;
      case 'pending_approval': return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Pending</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700">Approved</Badge>;
      case 'sent': return <Badge variant="secondary" className="bg-purple-500/20 text-purple-700">Sent</Badge>;
      case 'partially_paid': return <Badge className="bg-teal-500 hover:bg-teal-600">Partial</Badge>;
      case 'paid': return <Badge className="bg-emerald-600 hover:bg-emerald-700">Paid</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getAgingBadge = (aging?: string | null) => {
    if (!aging || aging === 'normal') return null;
    if (aging === 'warning') return <span className="inline-flex h-2 w-2 rounded-full bg-yellow-500 ml-2" title="Aging: 14+ days" />;
    return <span className="inline-flex h-2 w-2 rounded-full bg-destructive ml-2" title="Aging: 30+ days overdue" />;
  };

  const filteredInvoices = invoices?.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || 
    inv.clientName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage billing and track payments.</p>
        </div>
        {(role === 'operations' || role === 'management') && (
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/invoices/new">
              <Plus className="mr-2 h-4 w-4" /> Generate Invoice
            </Link>
          </Button>
        )}
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/10">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search invoice # or client..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto"></div></TableCell>
                    <TableCell><div className="h-6 w-16 bg-muted animate-pulse rounded-full"></div></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono font-medium text-primary">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline flex items-center">
                        {inv.invoiceNumber}
                        {getAgingBadge(inv.agingStatus)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{inv.clientName}</TableCell>
                    <TableCell className="text-sm">{format(new Date(inv.createdAt), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right font-medium">₹{inv.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">
                      ₹{inv.dueAmount?.toLocaleString() || 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 items-start">
                        {getStatusBadge(inv.status)}
                        {inv.lastReminderSentAt && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap" title={`Last reminder: ${format(new Date(inv.lastReminderSentAt), "dd MMM yyyy, hh:mm a")}`}>
                            Reminded: {format(new Date(inv.lastReminderSentAt), "dd MMM")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/invoices/${inv.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
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
