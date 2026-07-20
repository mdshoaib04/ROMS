import { useState } from "react";
import { useListReleaseOrders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Search, Filter, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";

export default function ReleaseOrders() {
  const { role } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: ros, isLoading } = useListReleaseOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>;
      case 'pending_approval': return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30">Pending</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 hover:bg-blue-500/30">Approved</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      case 'completed': return <Badge variant="outline" className="text-muted-foreground">Completed</Badge>;
      case 'stopped': return <Badge variant="destructive" className="bg-red-900">Stopped</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRos = ros?.filter(ro => 
    ro.roNumber.toLowerCase().includes(search.toLowerCase()) || 
    ro.clientName.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Release Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage active and pending advertising schedules.</p>
        </div>
        {(role === 'operations' || role === 'sales') && (
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
            <Link href="/release-orders/new">
              <Plus className="mr-2 h-4 w-4" /> Create RO
            </Link>
          </Button>
        )}
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4 bg-muted/10">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search RO number or client..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px]">RO Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Media Types</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-6 w-16 bg-muted animate-pulse rounded-full"></div></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredRos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No release orders found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRos.map((ro) => (
                  <TableRow key={ro.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono font-medium text-primary">
                      <Link href={`/release-orders/${ro.id}`} className="hover:underline">
                        {ro.roNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{ro.clientName}</div>
                      {ro.agencyName && <div className="text-xs text-muted-foreground">via {ro.agencyName}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="whitespace-nowrap">{format(new Date(ro.publishFrom), "dd MMM yy")} -</div>
                      <div className="whitespace-nowrap">{format(new Date(ro.publishTo), "dd MMM yy")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap max-w-[150px]">
                        {ro.scrollKannada && <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded border border-secondary/20">Scr-KA</span>}
                        {ro.scrollMarathi && <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded border border-secondary/20">Scr-MR</span>}
                        {ro.audioVideoKannada && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">Vid-KA</span>}
                        {ro.audioVideoMarathi && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">Vid-MR</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(ro.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/release-orders/${ro.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Details</span>
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
