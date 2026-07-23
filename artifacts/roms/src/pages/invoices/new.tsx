import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useCreateInvoice, 
  useListClients, 
  useListReleaseOrders,
  useListPlayoutReports 
} from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Loader2, Calculator } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const schema = z.object({
  clientId: z.coerce.number().min(1, "Client is required"),
  releaseOrderId: z.coerce.number().min(1, "RO is required"),
  playoutReportId: z.coerce.number().optional().nullable(),
  publishFrom: z.string().min(1, "Required"),
  publishTo: z.string().min(1, "Required"),
  scrollKannadaDays: z.coerce.number().default(0),
  scrollKannadaRate: z.coerce.number().default(0),
  scrollMarathiDays: z.coerce.number().default(0),
  scrollMarathiRate: z.coerce.number().default(0),
  videoKannadaDays: z.coerce.number().default(0),
  videoKannadaRate: z.coerce.number().default(0),
  videoMarathiDays: z.coerce.number().default(0),
  videoMarathiRate: z.coerce.number().default(0),
  videoCreativeCharges: z.coerce.number().default(0),
  includeGst: z.boolean().default(true),
});

export default function InvoiceNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMut = useCreateInvoice();

  const [editLinkDetails, setEditLinkDetails] = useState(false);
  const [editLineItems, setEditLineItems] = useState(false);
  
  const { data: clients } = useListClients();
  const { data: allRos } = useListReleaseOrders();
  const { data: playoutReports } = useListPlayoutReports();
  const ros = allRos?.filter(ro => ro.status !== 'rejected') || [];

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      includeGst: true,
      publishFrom: format(new Date(), "yyyy-MM-dd"),
      publishTo: format(new Date(), "yyyy-MM-dd"),
      scrollKannadaDays: 0,
      scrollKannadaRate: 0,
      scrollMarathiDays: 0,
      scrollMarathiRate: 0,
      videoKannadaDays: 0,
      videoKannadaRate: 0,
      videoMarathiDays: 0,
      videoMarathiRate: 0,
      videoCreativeCharges: 0,
    },
  });

  const watchAll = form.watch();
  
  // Auto-calculate totals purely for display
  const subtotal = 
    (Number(watchAll.scrollKannadaDays || 0) * Number(watchAll.scrollKannadaRate || 0)) +
    (Number(watchAll.scrollMarathiDays || 0) * Number(watchAll.scrollMarathiRate || 0)) +
    (Number(watchAll.videoKannadaDays || 0) * Number(watchAll.videoKannadaRate || 0)) +
    (Number(watchAll.videoMarathiDays || 0) * Number(watchAll.videoMarathiRate || 0)) +
    Number(watchAll.videoCreativeCharges || 0);
  
  const gstAmount = watchAll.includeGst ? subtotal * 0.18 : 0;
  const total = subtotal + gstAmount;

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMut.mutate({ 
      data: {
        ...values,
        playoutReportId: values.playoutReportId || undefined,
        cgstPercent: values.includeGst ? 9 : 0,
        sgstPercent: values.includeGst ? 9 : 0,
      } 
    }, {
      onSuccess: (res) => {
        toast({ title: "Invoice Created", description: `Draft invoice ${res.invoiceNumber} generated.` });
        setLocation(`/invoices/${res.id}`);
      },
      onError: (err: any) => {
        toast({
          title: "Submission Failed",
          description: err.message || "Failed to generate invoice. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const onInvalid = (errors: any) => {
    console.error("Validation errors on invoice generation:", errors);
    const errorMsg = Object.entries(errors)
      .map(([key, err]: [string, any]) => `${key}: ${err.message}`)
      .join(", ");
    toast({
      title: "Validation Failed",
      description: errorMsg || "Please check the required fields.",
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/invoices"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generate Invoice</h1>
          <p className="text-muted-foreground text-sm mt-1">Create a new billing document.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-4">
                  <CardTitle className="text-lg">Link Details</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditLinkDetails(!editLinkDetails)}>
                    {editLinkDetails ? "Lock" : "Edit"}
                  </Button>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="clientId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {clients?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="releaseOrderId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Release Order *</FormLabel>
                      <Select 
                        onValueChange={(v) => {
                          const roId = Number(v);
                          field.onChange(roId);
                          const selectedRo = ros.find(r => r.id === roId);
                          if (selectedRo) {
                            if (selectedRo.clientId) form.setValue('clientId', selectedRo.clientId);
                            if (selectedRo.publishFrom) form.setValue('publishFrom', selectedRo.publishFrom);
                            if (selectedRo.publishTo) form.setValue('publishTo', selectedRo.publishTo);
                            
                            const report = playoutReports?.find(pr => pr.releaseOrderId === roId);
                            
                            const from = new Date(selectedRo.publishFrom);
                            const to = new Date(selectedRo.publishTo);
                            const diffTime = Math.abs(to.getTime() - from.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            
                            if (report) {
                              form.setValue('playoutReportId', report.id);
                              form.setValue('scrollKannadaDays', report.scrollKannadaDays || 0);
                              form.setValue('scrollMarathiDays', report.scrollMarathiDays || 0);
                              form.setValue('videoKannadaDays', report.videoKannadaDays || 0);
                              form.setValue('videoMarathiDays', report.videoMarathiDays || 0);
                            } else {
                              form.setValue('playoutReportId', null);
                              form.setValue('scrollKannadaDays', selectedRo.scrollKannada ? diffDays : 0);
                              form.setValue('scrollMarathiDays', selectedRo.scrollMarathi ? diffDays : 0);
                              form.setValue('videoKannadaDays', selectedRo.audioVideoKannada ? diffDays : 0);
                              form.setValue('videoMarathiDays', selectedRo.audioVideoMarathi ? diffDays : 0);
                            }

                            const rateVal = selectedRo.ratePerDay ? Number(selectedRo.ratePerDay) : 0;
                            form.setValue('scrollKannadaRate', selectedRo.scrollKannada ? rateVal : 0);
                            form.setValue('scrollMarathiRate', selectedRo.scrollMarathi ? rateVal : 0);
                            form.setValue('videoKannadaRate', selectedRo.audioVideoKannada ? rateVal : 0);
                            form.setValue('videoMarathiRate', selectedRo.audioVideoMarathi ? rateVal : 0);
                          }
                        }} 
                        value={field.value?.toString()}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="Select RO" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {ros?.map((ro) => <SelectItem key={ro.id} value={ro.id.toString()}>{ro.roNumber} ({ro.clientName || `Client ${ro.clientId}`})</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="publishFrom" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period From (YYYY-MM-DD)</FormLabel>
                      <FormControl><Input type="date" disabled={!editLinkDetails} {...field} /></FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="publishTo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period To (YYYY-MM-DD)</FormLabel>
                      <FormControl><Input type="date" disabled={!editLinkDetails} {...field} /></FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Line Items</CardTitle>
                    <CardDescription>Enter quantity (days) and daily rate for each active format.</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditLineItems(!editLineItems)}>
                    {editLineItems ? "Lock" : "Edit"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  <div className="grid grid-cols-12 gap-4 items-center border-b pb-4">
                    <div className="col-span-4 font-medium text-sm">Description</div>
                    <div className="col-span-3 font-medium text-sm">Qty (Days)</div>
                    <div className="col-span-3 font-medium text-sm">Rate/Day (₹)</div>
                    <div className="col-span-2 font-medium text-sm text-right">Amount</div>
                  </div>

                  {[
                    { key: "scrollKannada", label: "Scroll Kannada" },
                    { key: "scrollMarathi", label: "Scroll Marathi" },
                    { key: "videoKannada", label: "Video Kannada" },
                    { key: "videoMarathi", label: "Video Marathi" },
                  ].map((item) => (
                    <div key={item.key} className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4 text-sm font-medium text-muted-foreground">{item.label}</div>
                      <div className="col-span-3">
                        <FormField control={form.control} name={`${item.key}Days` as any} render={({ field }) => (
                          <FormItem><FormControl><Input type="number" disabled={!editLineItems} {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="col-span-3">
                        <FormField control={form.control} name={`${item.key}Rate` as any} render={({ field }) => (
                          <FormItem><FormControl><Input type="number" disabled={!editLineItems} {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="col-span-2 text-right font-mono text-sm text-muted-foreground">
                        {((watchAll[`${item.key}Days` as keyof typeof watchAll] as number || 0) * (watchAll[`${item.key}Rate` as keyof typeof watchAll] as number || 0)).toLocaleString()}
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-12 gap-4 items-center pt-4 border-t border-dashed">
                    <div className="col-span-7 text-sm font-medium text-muted-foreground">Creative Charges</div>
                    <div className="col-span-3">
                      <FormField control={form.control} name="videoCreativeCharges" render={({ field }) => (
                        <FormItem><FormControl><Input type="number" disabled={!editLineItems} {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm text-muted-foreground">
                      {(watchAll.videoCreativeCharges || 0).toLocaleString()}
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="sticky top-20 border-primary shadow-md">
                <CardHeader className="bg-primary/5 border-b pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" /> Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  
                  <FormField control={form.control} name="includeGst" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-background">
                      <div className="space-y-0.5">
                        <FormLabel>Apply GST (18%)</FormLabel>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />

                  <div className="space-y-2 text-sm pt-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-mono">₹ {subtotal.toLocaleString()}</span>
                    </div>
                    {watchAll.includeGst && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CGST @ 9%</span>
                          <span className="font-mono">₹ {(gstAmount / 2).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">SGST @ 9%</span>
                          <span className="font-mono">₹ {(gstAmount / 2).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 text-primary">
                      <span>Total</span>
                      <span className="font-mono">₹ {total.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button type="submit" className="w-full mt-4" disabled={createMut.isPending || total === 0}>
                    {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Invoice
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

        </form>
      </Form>
    </div>
  );
}
