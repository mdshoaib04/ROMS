import { 
  useGetDashboardSummary, 
  useGetActiveMedia, 
  useGetExpiringSoon, 
  useGetPendingInvoices,
  useListReleaseOrders,
  useListPlayoutReports
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  TrendingUp,
  Receipt,
  IndianRupee
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { role, user } = useAuth();
  
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activeMedia, isLoading: isLoadingMedia } = useGetActiveMedia();
  const { data: expiringSoon, isLoading: isLoadingExpiring } = useGetExpiringSoon();
  const { data: pendingInvoices, isLoading: isLoadingInvoices } = useGetPendingInvoices();
  const { data: releaseOrders } = useListReleaseOrders();
  const { data: playoutReports } = useListPlayoutReports();

  const todayStr = new Date().toISOString().split("T")[0];
  const missedStartROs = releaseOrders?.filter((ro: any) => 
    ro.status === 'pending_approval' && todayStr >= ro.publishFrom
  ) || [];

  const pendingPlayoutROs = releaseOrders?.filter((ro: any) => {
    if (ro.status !== 'completed') return false;
    const hasReport = playoutReports?.some((pr: any) => pr.releaseOrderId === ro.id);
    return !hasReport;
  }) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const getAgingColor = (status: string) => {
    switch (status) {
      case 'overdue': return 'bg-destructive text-destructive-foreground';
      case 'warning': return 'bg-yellow-500 text-white';
      default: return 'bg-green-500 text-white';
    }
  };

  if (isLoadingSummary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground/90">
          Dashboard Overview
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {format(new Date(), "EEEE, do MMMM yyyy")}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Active ROs</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{summary?.totalActiveROs || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 text-primary font-medium">Running on air</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Pending Approval</CardTitle>
            <FileText className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{summary?.totalPendingApproval || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires management action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-secondary">{formatCurrency(summary?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Billed this month</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Outstanding</CardTitle>
            <IndianRupee className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-destructive">{formatCurrency(summary?.totalOutstanding || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total pending payments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Recent Activity Stream */}
        <Card className="lg:col-span-4 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> System Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0 divide-y">
              {summary?.recentActivity?.length ? (
                summary.recentActivity.map((activity, i) => (
                  <div key={activity.id} className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <div className="mt-0.5">
                      {activity.type === 'ro_approved' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                      {activity.type === 'invoice_sent' && <Receipt className="h-5 w-5 text-blue-500" />}
                      {activity.type === 'payment_received' && <IndianRupee className="h-5 w-5 text-emerald-500" />}
                      {!['ro_approved', 'invoice_sent', 'payment_received'].includes(activity.type) && <FileText className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.timestamp), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Queues based on Role */}
        <Card className="lg:col-span-3 shadow-sm border-border flex flex-col">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" /> Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-auto">
            {/* Missed Start Date ROs (Management & Operations) */}
            {(role === 'management' || role === 'operations') && missedStartROs.length > 0 && (
              <div className="p-4 border-b bg-destructive/5">
                <h4 className="font-semibold text-sm mb-3 flex items-center justify-between text-destructive">
                  Missed Start Dates (Needs Approval)
                  <Badge className="bg-red-600 text-white font-mono h-5">
                    {missedStartROs.length}
                  </Badge>
                </h4>
                <div className="space-y-2">
                  {missedStartROs.map((ro: any) => (
                    <div key={ro.id} className="flex justify-between items-center bg-background p-2 rounded border border-destructive/20 shadow-sm">
                      <div>
                        <Link href={`/release-orders/${ro.id}`} className="font-mono text-sm text-primary hover:underline font-semibold">{ro.roNumber}</Link>
                        <p className="text-xs truncate max-w-[150px] font-medium">{ro.clientName}</p>
                      </div>
                      <Badge className="bg-red-600 text-white text-[10px] whitespace-nowrap h-5">
                        Due {format(new Date(ro.publishFrom), "MMM d")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Playout Reports (Coordinator & Operations) */}
            {(role === 'coordinator' || role === 'operations' || role === 'management') && pendingPlayoutROs.length > 0 && (
              <div className="p-4 border-b bg-orange-500/5">
                <h4 className="font-semibold text-sm mb-3 flex items-center justify-between text-orange-700">
                  Playout Reports Pending
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-700 border-orange-500/30 font-mono h-5">
                    {pendingPlayoutROs.length}
                  </Badge>
                </h4>
                <div className="space-y-2">
                  {pendingPlayoutROs.map((ro: any) => (
                    <div key={ro.id} className="flex justify-between items-center bg-background p-2 rounded border border-orange-500/20 shadow-sm">
                      <div>
                        <Link href={`/release-orders/${ro.id}`} className="font-mono text-sm text-primary hover:underline font-semibold">{ro.roNumber}</Link>
                        <p className="text-xs truncate max-w-[150px] font-medium">{ro.clientName}</p>
                      </div>
                      <Button size="sm" variant="outline" asChild className="h-7 text-xs border-orange-500/30 hover:bg-orange-500/10">
                        <Link href={`/playout-reports/new?releaseOrderId=${ro.id}`}>File Report</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Expiring Soon (Coordinator & Operations) */}
            {(role === 'coordinator' || role === 'operations' || role === 'management') && (
              <div className="p-4 border-b bg-yellow-500/5">
                <h4 className="font-semibold text-sm mb-3 flex items-center justify-between">
                  Expiring ROs (Next 3 Days)
                  <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                    {expiringSoon?.length || 0}
                  </Badge>
                </h4>
                <div className="space-y-2">
                  {expiringSoon?.slice(0, 3).map((ro: any) => (
                    <div key={ro.id} className="flex justify-between items-center bg-background p-2 rounded border border-yellow-500/20 shadow-sm">
                      <div>
                        <Link href={`/release-orders/${ro.id}`} className="font-mono text-sm text-primary hover:underline">{ro.roNumber}</Link>
                        <p className="text-xs truncate max-w-[150px]">{ro.clientName}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Ends {format(new Date(ro.publishTo), "MMM d")}
                      </Badge>
                    </div>
                  ))}
                  {expiringSoon?.length === 0 && <p className="text-xs text-muted-foreground">No ROs expiring soon.</p>}
                  {expiringSoon && expiringSoon.length > 3 && (
                    <Button variant="link" className="w-full h-8 text-xs p-0" asChild>
                      <Link href="/release-orders">View all {expiringSoon.length} expiring</Link>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Pending Invoices (Operations & Management) */}
            {(role === 'operations' || role === 'management') && (
              <div className="p-4 border-b bg-destructive/5">
                <h4 className="font-semibold text-sm mb-3 flex items-center justify-between">
                  Overdue & Warning Invoices
                  <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                    {pendingInvoices?.filter((i: any) => i.agingStatus !== 'normal').length || 0}
                  </Badge>
                </h4>
                <div className="space-y-2">
                  {pendingInvoices?.filter((i: any) => i.agingStatus !== 'normal').slice(0, 4).map((invoice: any) => (
                    <div key={invoice.id} className="flex justify-between items-center bg-background p-2 rounded border shadow-sm">
                      <div>
                        <Link href={`/invoices/${invoice.id}`} className="font-mono text-sm hover:underline">{invoice.invoiceNumber}</Link>
                        <p className="text-xs truncate max-w-[120px]">{invoice.clientName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">{formatCurrency(invoice.dueAmount)}</p>
                        <Badge className={`text-[10px] px-1 py-0 h-4 ${getAgingColor(invoice.agingStatus)}`}>
                          {invoice.agingDays} days
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {pendingInvoices?.filter((i: any) => i.agingStatus !== 'normal').length === 0 && (
                    <p className="text-xs text-muted-foreground">No overdue invoices.</p>
                  )}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
