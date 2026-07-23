import { useState } from "react";
import { Link } from "wouter";
import { useListPlayoutReports } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Plus, Search, Eye, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";

export default function PlayoutReports() {
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const { data: reports, isLoading } = useListPlayoutReports();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="outline">Draft</Badge>;
      case 'submitted': return <Badge className="bg-blue-600">Submitted</Badge>;
      case 'invoiced': return <Badge className="bg-emerald-600">Invoiced</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filteredReports = reports?.filter(r => 
    r.roNumber.toLowerCase().includes(search.toLowerCase()) || 
    r.clientName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playout Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Telecast logs and execution tracking.</p>
        </div>
        {(role === 'coordinator' || role === 'operations') && (
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/playout-reports/new">
              <Plus className="mr-2 h-4 w-4" /> Create Report
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
                placeholder="Search RO number or client..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>RO Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Report Date</TableHead>
                <TableHead>Spots</TableHead>
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
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-6 w-16 bg-muted animate-pulse rounded-full"></div></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    No playout reports found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono font-medium text-primary">
                      <Link href={`/release-orders/${report.releaseOrderId}`} className="hover:underline">
                        {report.roNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{report.clientName}</TableCell>
                    <TableCell className="text-sm">{format(new Date(report.reportDate), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{report.totalSpotsAired}</span>
                        <span className="text-muted-foreground text-xs">/ {report.totalSpotsScheduled}</span>
                        {report.varianceFlag === "under-aired" && (
                          <Badge variant="destructive" className="h-5 text-[10px] px-1.5 py-0 ml-1 whitespace-nowrap">
                            Under-aired ({Math.abs(report.variancePercent ?? 0).toFixed(1)}%)
                          </Badge>
                        )}
                        {report.varianceFlag === "over-aired" && (
                          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white h-5 text-[10px] px-1.5 py-0 ml-1 whitespace-nowrap">
                            Over-aired (+{Math.abs(report.variancePercent ?? 0).toFixed(1)}%)
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/playout-reports/${report.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
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
