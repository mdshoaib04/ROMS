import { useState } from "react";
import { useListPayments, useListInvoices, useRecordPayment } from "@workspace/api-client-react";
import { format } from "date-fns";
import { IndianRupee, Search, Plus, Loader2, Link } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const paymentSchema = z.object({
  invoiceId: z.coerce.number().min(1, "Invoice required"),
  amount: z.coerce.number().min(1, "Amount required"),
  paymentMode: z.enum(["upi", "cheque", "bank_transfer", "cash"]),
  paymentReference: z.string().optional(),
  paymentDate: z.string().min(1),
  notes: z.string().optional()
});

export default function Payments() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useListPayments();
  const { data: invoices } = useListInvoices();
  const recordMut = useRecordPayment();

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      paymentMode: "bank_transfer"
    }
  });

  const selectedMode = form.watch("paymentMode");

  const onSubmit = (values: z.infer<typeof paymentSchema>) => {
    recordMut.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Payment Recorded", description: "The payment has been applied." });
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to Record Payment", 
          description: err?.data?.error || err?.message || "An error occurred while saving the payment.", 
          variant: "destructive" 
        });
      }
    });
  };

  const onInvalid = (errors: any) => {
    const firstErr = Object.values(errors)[0] as any;
    toast({ 
      title: "Validation Error", 
      description: firstErr?.message || "Please check the form inputs.", 
      variant: "destructive" 
    });
  };

  const filteredPayments = payments?.filter(p => 
    p.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) || 
    p.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    p.paymentReference?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">Record and track client payments.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" /> Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4 pt-4">
                <FormField control={form.control} name="invoiceId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apply to Invoice</FormLabel>
                    <Select onValueChange={v => field.onChange(Number(v))} value={field.value?.toString()}>
                       <FormControl><SelectTrigger><SelectValue placeholder="Select pending invoice" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {invoices?.filter(i => i.status !== 'paid' && i.status !== 'draft').map(i => (
                          <SelectItem key={i.id} value={i.id.toString()}>
                            {i.invoiceNumber} - {i.clientName} (Due: ₹{i.dueAmount?.toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Received (₹)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="paymentDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="paymentMode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="bank_transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {selectedMode !== "cash" && (
                    <FormField control={form.control} name="paymentReference" render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {selectedMode === "upi" && "UTR Number"}
                          {selectedMode === "cheque" && "Cheque Number"}
                          {selectedMode === "bank_transfer" && "Transaction Reference (NEFT/RTGS/IMPS No.)"}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={
                              selectedMode === "upi" ? "Enter UTR number" :
                              selectedMode === "cheque" ? "Enter cheque number" :
                              selectedMode === "bank_transfer" ? "Enter transaction reference" : ""
                            }
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={recordMut.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                    {recordMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Payment
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/10">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search reference or invoice..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client & Invoice</TableHead>
                <TableHead>Method & Ref</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto"></div></TableCell>
                  </TableRow>
                ))
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    <IndianRupee className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-sm">{payment.paymentDate ? format(new Date(payment.paymentDate), "dd MMM yyyy") : "-"}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{payment.clientName}</div>
                      <Link href={`/invoices/${payment.invoiceId}`} className="text-xs text-primary hover:underline font-mono">
                        {payment.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-[10px] mb-1">{payment.paymentMode.replace('_', ' ')}</Badge>
                      <div className="text-xs font-mono text-muted-foreground">{payment.paymentReference || "-"}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      ₹{payment.amount.toLocaleString()}
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
