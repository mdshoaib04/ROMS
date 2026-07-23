import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useListReleaseOrders, useCreatePlayoutReport } from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ChevronLeft, Loader2, FileSpreadsheet, CalendarIcon } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const schema = z.object({
  releaseOrderId: z.coerce.number().min(1, "Release Order is required"),
  reportDate: z.string().min(1, "Date is required"),
  publishFrom: z.string().min(1, "Date is required"),
  publishTo: z.string().min(1, "Date is required"),
  totalSpotsScheduled: z.coerce.number().min(1),
  totalSpotsAired: z.coerce.number().min(0),
  scrollKannadaDays: z.coerce.number().default(0),
  scrollMarathiDays: z.coerce.number().default(0),
  videoKannadaDays: z.coerce.number().default(0),
  videoMarathiDays: z.coerce.number().default(0),
  discrepancyNote: z.string().optional(),
  screenshotUrl: z.string().url().optional().or(z.literal('')),
});

export default function PlayoutReportNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMut = useCreatePlayoutReport();
  
  const [editReference, setEditReference] = useState(false);
  const [editMetrics, setEditMetrics] = useState(false);

  // Fetch all ROs so completed ones are available for selection
  const { data: ros, isLoading: loadingRos } = useListReleaseOrders();

  const searchParams = new URLSearchParams(window.location.search);
  const qRoId = searchParams.get("releaseOrderId");
  const roIdParam = qRoId ? parseInt(qRoId, 10) : null;

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      reportDate: format(new Date(), "yyyy-MM-dd"),
      scrollKannadaDays: 0,
      scrollMarathiDays: 0,
      videoKannadaDays: 0,
      videoMarathiDays: 0,
      totalSpotsScheduled: 0,
      totalSpotsAired: 0,
    },
  });

  useEffect(() => {
    if (roIdParam && ros && ros.length > 0) {
      const selectedRo = ros.find((r: any) => r.id === roIdParam);
      if (selectedRo) {
        form.setValue("releaseOrderId", roIdParam);
        if (selectedRo.publishFrom) form.setValue('publishFrom', selectedRo.publishFrom);
        if (selectedRo.publishTo) form.setValue('publishTo', selectedRo.publishTo);
        
        const from = new Date(selectedRo.publishFrom);
        const to = new Date(selectedRo.publishTo);
        const diffTime = Math.abs(to.getTime() - from.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        let channelsCount = 0;
        if (selectedRo.scrollKannada) channelsCount++;
        if (selectedRo.scrollMarathi) channelsCount++;
        if (selectedRo.audioVideoKannada) channelsCount++;
        if (selectedRo.audioVideoMarathi) channelsCount++;
        
        const scheduledSpots = diffDays * (selectedRo.repeatTimes || 0) * (channelsCount || 1);
        form.setValue('totalSpotsScheduled', scheduledSpots);
        form.setValue('totalSpotsAired', scheduledSpots);
        
        form.setValue('scrollKannadaDays', selectedRo.scrollKannada ? diffDays : 0);
        form.setValue('scrollMarathiDays', selectedRo.scrollMarathi ? diffDays : 0);
        form.setValue('videoKannadaDays', selectedRo.audioVideoKannada ? diffDays : 0);
        form.setValue('videoMarathiDays', selectedRo.audioVideoMarathi ? diffDays : 0);
      }
    }
  }, [roIdParam, ros]);

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMut.mutate({ data: values }, {
      onSuccess: (res) => {
        toast({ title: "Report Submitted", description: `Playout report saved.` });
        setLocation(`/playout-reports/${res.id}`);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/playout-reports"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Playout Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Log telecast execution data for billing.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-4">
              <CardTitle className="text-lg">Reference Data</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditReference(!editReference)}>
                {editReference ? "Lock" : "Edit"}
              </Button>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="releaseOrderId" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Active Release Order *</FormLabel>
                  <Select 
                    onValueChange={(v) => {
                      const roId = Number(v);
                      field.onChange(roId);
                      const selectedRo = ros?.find(r => r.id === roId);
                      if (selectedRo) {
                        if (selectedRo.publishFrom) form.setValue('publishFrom', selectedRo.publishFrom);
                        if (selectedRo.publishTo) form.setValue('publishTo', selectedRo.publishTo);
                        
                        const from = new Date(selectedRo.publishFrom);
                        const to = new Date(selectedRo.publishTo);
                        const diffTime = Math.abs(to.getTime() - from.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        
                        let channelsCount = 0;
                        if (selectedRo.scrollKannada) channelsCount++;
                        if (selectedRo.scrollMarathi) channelsCount++;
                        if (selectedRo.audioVideoKannada) channelsCount++;
                        if (selectedRo.audioVideoMarathi) channelsCount++;
                        
                        const scheduledSpots = diffDays * (selectedRo.repeatTimes || 0) * (channelsCount || 1);
                        form.setValue('totalSpotsScheduled', scheduledSpots);
                        form.setValue('totalSpotsAired', scheduledSpots);
                        
                        form.setValue('scrollKannadaDays', selectedRo.scrollKannada ? diffDays : 0);
                        form.setValue('scrollMarathiDays', selectedRo.scrollMarathi ? diffDays : 0);
                        form.setValue('videoKannadaDays', selectedRo.audioVideoKannada ? diffDays : 0);
                        form.setValue('videoMarathiDays', selectedRo.audioVideoMarathi ? diffDays : 0);
                      }
                    }} 
                    value={field.value?.toString()}
                  >
                    <FormControl><SelectTrigger disabled={loadingRos}><SelectValue placeholder="Select RO" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ros?.map((ro) => <SelectItem key={ro.id} value={ro.id.toString()}>{ro.roNumber} - {ro.clientName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="reportDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Report</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="screenshotUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Proof URL (Drive/Dropbox)</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="publishFrom" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Execution From</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          disabled={!editReference}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="publishTo" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Execution To</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          disabled={!editReference}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => {
                          field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                          // trigger spots schedule recalculation if edit is enabled or details loaded
                          if (form.getValues("releaseOrderId")) {
                            const roId = Number(form.getValues("releaseOrderId"));
                            const selectedRo = ros?.find(r => r.id === roId);
                            if (selectedRo) {
                              const fromStr = form.getValues("publishFrom");
                              const toStr = date ? format(date, "yyyy-MM-dd") : "";
                              if (fromStr && toStr) {
                                const from = new Date(fromStr);
                                const to = new Date(toStr);
                                const diffTime = Math.abs(to.getTime() - from.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                
                                let channelsCount = 0;
                                if (selectedRo.scrollKannada) channelsCount++;
                                if (selectedRo.scrollMarathi) channelsCount++;
                                if (selectedRo.audioVideoKannada) channelsCount++;
                                if (selectedRo.audioVideoMarathi) channelsCount++;
                                
                                const scheduledSpots = diffDays * (selectedRo.repeatTimes || 0) * (channelsCount || 1);
                                form.setValue('totalSpotsScheduled', scheduledSpots);
                                form.setValue('totalSpotsAired', scheduledSpots);
                                form.setValue('scrollKannadaDays', selectedRo.scrollKannada ? diffDays : 0);
                                form.setValue('scrollMarathiDays', selectedRo.scrollMarathi ? diffDays : 0);
                                form.setValue('videoKannadaDays', selectedRo.audioVideoKannada ? diffDays : 0);
                                form.setValue('videoMarathiDays', selectedRo.audioVideoMarathi ? diffDays : 0);
                              }
                            }
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-4">
              <CardTitle className="text-lg">Execution Metrics</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditMetrics(!editMetrics)}>
                {editMetrics ? "Lock" : "Edit"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 border rounded-md">
                <FormField control={form.control} name="totalSpotsScheduled" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spots Scheduled (Expected)</FormLabel>
                    <FormControl><Input type="number" disabled={!editMetrics} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="totalSpotsAired" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Spots Aired</FormLabel>
                    <FormControl><Input type="number" {...field} className="font-bold border-primary" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FormField control={form.control} name="scrollKannadaDays" render={({ field }) => (
                  <FormItem><FormLabel>Scroll KA (Days)</FormLabel><FormControl><Input type="number" disabled={!editMetrics} {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="scrollMarathiDays" render={({ field }) => (
                  <FormItem><FormLabel>Scroll MR (Days)</FormLabel><FormControl><Input type="number" disabled={!editMetrics} {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="videoKannadaDays" render={({ field }) => (
                  <FormItem><FormLabel>Video KA (Days)</FormLabel><FormControl><Input type="number" disabled={!editMetrics} {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="videoMarathiDays" render={({ field }) => (
                  <FormItem><FormLabel>Video MR (Days)</FormLabel><FormControl><Input type="number" disabled={!editMetrics} {...field} /></FormControl></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="discrepancyNote" render={({ field }) => (
                <FormItem>
                  <FormLabel>Discrepancy / Exception Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Explain if actual spots < scheduled spots..." className="h-24 resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild><Link href="/playout-reports">Cancel</Link></Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
