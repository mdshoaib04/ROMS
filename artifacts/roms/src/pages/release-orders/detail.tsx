import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useGetReleaseOrder, 
  useApproveReleaseOrder, 
  useRejectReleaseOrder,
  useStopReleaseOrder,
  getGetReleaseOrderQueryKey
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { ChevronLeft, Check, X, Ban, Printer, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function ReleaseOrderDetail({ id }: { id: string }) {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const roId = parseInt(id);

  const { data: ro, isLoading } = useGetReleaseOrder(roId, {
    query: { enabled: !!roId, queryKey: getGetReleaseOrderQueryKey(roId) }
  });

  const approveMut = useApproveReleaseOrder();
  const rejectMut = useRejectReleaseOrder();
  const stopMut = useStopReleaseOrder();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [reason, setReason] = useState("");

  const handleApprove = () => {
    approveMut.mutate({ params: { id: roId } }, {
      onSuccess: () => {
        toast({ title: "Approved", description: "Release order has been approved." });
        queryClient.invalidateQueries({ queryKey: getGetReleaseOrderQueryKey(roId) });
      }
    });
  };

  const handleReject = () => {
    rejectMut.mutate({ params: { id: roId }, data: { reason } }, {
      onSuccess: () => {
        toast({ title: "Rejected", description: "Release order has been rejected." });
        setRejectOpen(false);
        setReason("");
        queryClient.invalidateQueries({ queryKey: getGetReleaseOrderQueryKey(roId) });
      }
    });
  };

  const handleStop = () => {
    stopMut.mutate({ params: { id: roId }, data: { reason } }, {
      onSuccess: () => {
        toast({ title: "Stopped", description: "Release order has been stopped." });
        setStopOpen(false);
        setReason("");
        queryClient.invalidateQueries({ queryKey: getGetReleaseOrderQueryKey(roId) });
      }
    });
  };

  if (isLoading || !ro) {
    return <div className="p-8 text-center animate-pulse">Loading RO details...</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-500 text-base py-1">Active</Badge>;
      case 'pending_approval': return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 text-base py-1">Pending Approval</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 text-base py-1">Approved</Badge>;
      case 'rejected': return <Badge variant="destructive" className="text-base py-1">Rejected</Badge>;
      case 'completed': return <Badge variant="outline" className="text-base py-1">Completed</Badge>;
      case 'stopped': return <Badge variant="destructive" className="bg-red-900 text-base py-1">Stopped</Badge>;
      default: return <Badge className="text-base py-1">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/release-orders"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              {ro.roNumber}
              {getStatusBadge(ro.status)}
            </h1>
            <p className="text-muted-foreground mt-1">Client: {ro.clientName} {ro.agencyName && `| Agency: ${ro.agencyName}`}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {ro.status === 'pending_approval' && role === 'management' && (
            <>
              <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => setRejectOpen(true)}>
                <X className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700">
                <Check className="mr-2 h-4 w-4" /> Approve
              </Button>
            </>
          )}

          {ro.status === 'active' && (role === 'operations' || role === 'coordinator') && (
            <Button variant="destructive" onClick={() => setStopOpen(true)}>
              <Ban className="mr-2 h-4 w-4" /> Stop Media
            </Button>
          )}

          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {(ro.rejectionReason || ro.stopReason) && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md flex items-start gap-3">
          <Ban className="h-5 w-5 mt-0.5" />
          <div>
            <h4 className="font-semibold">{ro.status === 'rejected' ? 'Rejection Reason' : 'Stop Reason'}</h4>
            <p className="text-sm mt-1">{ro.rejectionReason || ro.stopReason}</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-lg">Schedule & Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <p className="text-sm text-muted-foreground">Publish Date</p>
                  <p className="font-medium">{format(new Date(ro.publishFrom), "dd MMM yyyy")} - {format(new Date(ro.publishTo), "dd MMM yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RO Date</p>
                  <p className="font-medium">{ro.roDate ? format(new Date(ro.roDate), "dd MMM yyyy") : "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client Ref No</p>
                  <p className="font-mono">{ro.clientRoReference || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Creative Required</p>
                  <p className="font-medium">{ro.mediaDesignRequired ? "Yes (Internal)" : "No (Provided by client)"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-lg">Media Formats</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex gap-3 flex-wrap mb-6">
                {ro.scrollKannada && <Badge variant="secondary" className="px-3 py-1 bg-blue-100 text-blue-800 hover:bg-blue-100">Scroll Kannada</Badge>}
                {ro.scrollMarathi && <Badge variant="secondary" className="px-3 py-1 bg-blue-100 text-blue-800 hover:bg-blue-100">Scroll Marathi</Badge>}
                {ro.audioVideoKannada && <Badge className="px-3 py-1 bg-red-100 text-red-800 hover:bg-red-100">Video Kannada</Badge>}
                {ro.audioVideoMarathi && <Badge className="px-3 py-1 bg-red-100 text-red-800 hover:bg-red-100">Video Marathi</Badge>}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-lg border">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spot Type</p>
                  <p className="font-medium capitalize">{ro.spotType || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</p>
                  <p className="font-medium">{ro.spotDuration || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Repeats/Day</p>
                  <p className="font-medium">{ro.repeatTimes || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bonus Spots</p>
                  <p className="font-medium">{ro.bonusSpots || "0"}</p>
                </div>
              </div>

              {ro.notes && (
                <div className="mt-6">
                  <p className="text-sm font-semibold mb-2">Notes</p>
                  <div className="bg-muted/30 p-3 rounded text-sm text-muted-foreground whitespace-pre-wrap">
                    {ro.notes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-lg">Financials</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm text-muted-foreground">Rate Per Spot</span>
                  <span className="font-medium text-lg">₹ {ro.ratePerSpot?.toLocaleString() || "0"}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2">
                  <span className="text-muted-foreground text-xs">Total spots (est)</span>
                  <span>{((ro.repeatTimes || 0) * (ro.publishFrom ? Math.max(1, Math.ceil((new Date(ro.publishTo).getTime() - new Date(ro.publishFrom).getTime()) / (1000 * 60 * 60 * 24))) : 0))} spots</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-lg">Assets</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {ro.mediaUrl ? (
                <a href={ro.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 border rounded hover:bg-muted/50 transition-colors">
                  <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center text-primary">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">Download Media</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">{ro.mediaUrl}</p>
                  </div>
                </a>
              ) : (
                <div className="text-center p-6 border rounded border-dashed bg-muted/10 text-muted-foreground text-sm">
                  No media URL provided
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Release Order</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason for rejection</label>
            <Textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="Explain why this RO is being rejected..."
              className="h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!reason || rejectMut.isPending}>
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stopOpen} onOpenChange={setStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop Release Order</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason for stopping</label>
            <Textarea 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="e.g. Client request, Payment overdue..."
              className="h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStopOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleStop} disabled={!reason || stopMut.isPending}>
              Stop Media Playback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
