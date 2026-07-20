import { useListNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { format, formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle2, AlertTriangle, FileText, Receipt, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications();
  const readMut = useMarkNotificationRead();
  const queryClient = useQueryClient();

  const handleMarkRead = (id: number) => {
    readMut.mutate({ params: { id } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'ro_approved': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'ro_rejected': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'ro_expiring': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'invoice_overdue': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'playout_report_ready': return <FileText className="h-5 w-5 text-blue-500" />;
      case 'invoice_delay': return <Receipt className="h-5 w-5 text-yellow-500" />;
      default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getLink = (type: string, id?: number | null) => {
    if (!id) return "#";
    if (type.startsWith('ro_')) return `/release-orders/${id}`;
    if (type.startsWith('invoice_')) return `/invoices/${id}`;
    if (type.startsWith('playout_')) return `/playout-reports/${id}`;
    return "#";
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">System alerts and workflow updates.</p>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0 divide-y">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading alerts...</div>
          ) : notifications?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <Bell className="h-8 w-8 mb-3 opacity-20" />
              <p>You're all caught up.</p>
            </div>
          ) : (
            notifications?.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 flex items-start gap-4 transition-colors ${!notif.isRead ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
              >
                <div className="mt-1 shrink-0 bg-background rounded-full p-1 shadow-sm border">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className={`text-sm ${!notif.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {notif.relatedId ? (
                      <Link href={getLink(notif.type, notif.relatedId)} className="hover:underline hover:text-primary">
                        {notif.message}
                      </Link>
                    ) : (
                      notif.message
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notif.isRead && (
                  <Button variant="ghost" size="sm" onClick={() => handleMarkRead(notif.id)} className="h-8 text-xs text-primary">
                    Mark Read
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
