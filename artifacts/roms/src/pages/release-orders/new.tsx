import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useCreateReleaseOrder, 
  useListClients, 
  useListAgencies 
} from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, Loader2 } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  clientId: z.coerce.number().min(1, "Client is required"),
  agencyId: z.coerce.number().optional().nullable(),
  roDate: z.date().optional(),
  clientRoReference: z.string().optional(),
  publishFrom: z.date({ required_error: "Start date is required" }),
  publishTo: z.date({ required_error: "End date is required" }),
  scrollKannada: z.boolean().default(false),
  scrollMarathi: z.boolean().default(false),
  audioVideoKannada: z.boolean().default(false),
  audioVideoMarathi: z.boolean().default(false),
  repeatTimes: z.coerce.number().min(1).default(1),
  spotType: z.string().optional(),
  spotDuration: z.string().optional(),
  ratePerDay: z.coerce.number().optional(),
  bonusSpots: z.coerce.number().default(0),
  mediaDesignRequired: z.boolean().default(false),
  mediaUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export default function ReleaseOrderNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateReleaseOrder();
  
  const { data: clients, isLoading: loadingClients } = useListClients();
  const { data: agencies, isLoading: loadingAgencies } = useListAgencies();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roDate: new Date(),
      scrollKannada: false,
      scrollMarathi: false,
      audioVideoKannada: false,
      audioVideoMarathi: false,
      repeatTimes: 1,
      bonusSpots: 0,
      mediaDesignRequired: false,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Transform dates to strings for API
    const data = {
      ...values,
      agencyId: values.agencyId || undefined,
      roDate: values.roDate ? format(values.roDate, "yyyy-MM-dd") : undefined,
      publishFrom: format(values.publishFrom, "yyyy-MM-dd"),
      publishTo: format(values.publishTo, "yyyy-MM-dd"),
    };

    createMutation.mutate({ data }, {
      onSuccess: (res) => {
        toast({ title: "Release Order Created", description: `RO ${res.roNumber} has been created successfully.` });
        setLocation(`/release-orders/${res.id}`);
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || "Failed to create RO", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/release-orders"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Release Order</h1>
          <p className="text-muted-foreground text-sm mt-1">Create a new advertising schedule.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Client Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(Number(v))} 
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger disabled={loadingClients}>
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agencyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agency (Optional)</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(Number(v))} 
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger disabled={loadingAgencies}>
                            <SelectValue placeholder="Select an agency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agencies?.map((a) => (
                            <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientRoReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client RO Ref No.</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. PO-12345" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-2">
                  <FormField
                    control={form.control}
                    name="publishFrom"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="publishTo"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid gap-4 grid-cols-2">
                  <FormField
                    control={form.control}
                    name="roDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>RO Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Media Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2">Channels & Formats</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="scrollKannada" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-background">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="space-y-1 leading-none"><FormLabel>Scroll Kannada</FormLabel></div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="scrollMarathi" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-background">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="space-y-1 leading-none"><FormLabel>Scroll Marathi</FormLabel></div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="audioVideoKannada" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-background">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="space-y-1 leading-none"><FormLabel>A/V Kannada</FormLabel></div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="audioVideoMarathi" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-background">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="space-y-1 leading-none"><FormLabel>A/V Marathi</FormLabel></div>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2">Spot Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="spotType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Spot Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="prime">Prime</SelectItem>
                            <SelectItem value="repeat">Repeat</SelectItem>
                            <SelectItem value="l_band">L-Band</SelectItem>
                            <SelectItem value="aston">Aston</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="spotDuration" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select duration" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="10s">10s</SelectItem>
                            <SelectItem value="15s">15s</SelectItem>
                            <SelectItem value="20s">20s</SelectItem>
                            <SelectItem value="30s">30s</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="repeatTimes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repeats/Day</FormLabel>
                        <FormControl><Input type="number" {...field} className="bg-background" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="ratePerDay" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate Per Day (₹)</FormLabel>
                        <FormControl><Input type="number" {...field} className="bg-background" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="bonusSpots" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bonus Spots</FormLabel>
                        <FormControl><Input type="number" {...field} className="bg-background" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t pt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField control={form.control} name="mediaDesignRequired" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Creative Design Required?</FormLabel>
                          <FormDescription>Check if InNews is creating the video/banner</FormDescription>
                        </div>
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="mediaUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Media URL</FormLabel>
                        <FormControl><Input placeholder="https://drive.google.com/..." {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl><Textarea placeholder="Any special instructions..." className="h-32 resize-none" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/release-orders">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Release Order
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
