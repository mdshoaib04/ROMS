import { useGetClient, getGetClientQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { ChevronLeft, MapPin, Phone, Mail, FileText, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClientDetail({ id: propId }: { id?: string }) {
  const params = useParams<{ id: string }>();
  const idStr = params?.id || propId;
  const clientId = idStr ? parseInt(idStr, 10) : 0;
  const { data: client, isLoading } = useGetClient(clientId, {
    query: { enabled: !!clientId && !isNaN(clientId), queryKey: getGetClientQueryKey(clientId) }
  });

  if (isLoading || !client) return <div className="p-8 animate-pulse text-center">Loading client...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b pb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/clients"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-bold text-xl uppercase shadow-sm">
              {client.name.substring(0, 2)}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <Hash className="h-3 w-3" /> Client ID: {client.id}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit shadow-sm">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="text-lg">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {client.contactPerson && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Contact Person</p>
                <p className="font-medium">{client.contactPerson}</p>
              </div>
            )}
            
            <div className="flex items-start gap-3 text-sm">
              <Phone className="h-4 w-4 text-primary mt-0.5" />
              <div>{client.phone}</div>
            </div>
            
            {client.email && (
              <div className="flex items-start gap-3 text-sm">
                <Mail className="h-4 w-4 text-primary mt-0.5" />
                <div>{client.email}</div>
              </div>
            )}
            
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>{client.address}</div>
            </div>

            <div className="pt-4 mt-4 border-t">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">GST Number</p>
              <p className="font-mono text-sm bg-muted/50 p-2 rounded inline-block">{client.gstNumber || "Not provided"}</p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <Tabs defaultValue="ros" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
              <TabsTrigger value="ros">Release Orders</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ros">
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>RO history will appear here.</p>
                  <Button variant="link" asChild className="mt-2 text-primary">
                    <Link href={`/release-orders?clientId=${client.id}`}>View all filtered ROs</Link>
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="invoices">
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <p>Invoice history will appear here.</p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="payments">
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <p>Payment history will appear here.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
