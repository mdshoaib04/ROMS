import { useGetPlayoutReport, getGetPlayoutReportQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { ChevronLeft, FileSpreadsheet, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PlayoutReportDetail({ id: propId }: { id?: string }) {
  const params = useParams<{ id: string }>();
  const idStr = params?.id || propId;
  const reportId = idStr ? parseInt(idStr, 10) : 0;
  const { data: report, isLoading } = useGetPlayoutReport(reportId, {
    query: { enabled: !!reportId && !isNaN(reportId), queryKey: getGetPlayoutReportQueryKey(reportId) }
  });

  if (isLoading || !report) return <div className="p-8 animate-pulse text-center">Loading report...</div>;

  const isShort = report.totalSpotsAired < report.totalSpotsScheduled;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/playout-reports"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Report for RO {report.roNumber}
              <Badge variant={report.status === 'invoiced' ? 'default' : 'secondary'} className="uppercase text-xs tracking-wider">
                {report.status}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">Client: {report.clientName}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm border-border">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> Execution Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Report Date</p>
                <p className="font-medium">{format(new Date(report.reportDate), "dd MMM yyyy")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Telecast Period</p>
                <p className="font-medium">
                  {report.publishFrom ? format(new Date(report.publishFrom), "dd MMM yy") : "-"} to {report.publishTo ? format(new Date(report.publishTo), "dd MMM yy") : "-"}
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-lg border flex justify-between items-center ${
              report.varianceFlag === "under-aired"
                ? "bg-destructive/5 border-destructive/20"
                : report.varianceFlag === "over-aired"
                ? "bg-yellow-500/5 border-yellow-500/20"
                : "bg-green-500/5 border-green-500/20"
            }`}>
              <div>
                <p className="text-sm font-semibold mb-1">
                  Spot Execution 
                  {report.varianceFlag === "under-aired" && (
                    <span className="text-xs font-normal text-destructive ml-2 font-mono">({report.variancePercent?.toFixed(1)}%)</span>
                  )}
                  {report.varianceFlag === "over-aired" && (
                    <span className="text-xs font-normal text-yellow-600 ml-2 font-mono">(+{report.variancePercent?.toFixed(1)}%)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Actual vs Scheduled</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-bold flex items-center gap-2 justify-end">
                  {report.varianceFlag === "under-aired" && <AlertCircle className="h-5 w-5 text-destructive" />}
                  {report.varianceFlag === "over-aired" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                  <span className={
                    report.varianceFlag === "under-aired"
                      ? "text-destructive"
                      : report.varianceFlag === "over-aired"
                      ? "text-yellow-600"
                      : "text-green-600"
                  }>{report.totalSpotsAired}</span> 
                  <span className="text-muted-foreground text-lg">/ {report.totalSpotsScheduled}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 bg-muted/20 p-4 rounded-lg border">
              <div className="text-center border-r last:border-0">
                <p className="text-xl font-bold font-mono text-primary">{report.scrollKannadaDays || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Scr KA</p>
              </div>
              <div className="text-center border-r last:border-0">
                <p className="text-xl font-bold font-mono text-primary">{report.scrollMarathiDays || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Scr MR</p>
              </div>
              <div className="text-center border-r last:border-0">
                <p className="text-xl font-bold font-mono text-primary">{report.videoKannadaDays || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Vid KA</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-mono text-primary">{report.videoMarathiDays || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Vid MR</p>
              </div>
            </div>

            {report.discrepancyNote && (
              <div>
                <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Discrepancy Note
                </p>
                <div className="bg-destructive/10 p-3 rounded text-sm text-destructive whitespace-pre-wrap">
                  {report.discrepancyNote}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(report.createdAt), "dd MMM, HH:mm")}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Report ID</span>
                <span className="font-mono">PR-{report.id.toString().padStart(4, '0')}</span>
              </div>
              {report.screenshotUrl && (
                <div className="pt-2">
                  <Button variant="outline" className="w-full" asChild>
                    <a href={report.screenshotUrl} target="_blank" rel="noreferrer">
                      View Proof <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
