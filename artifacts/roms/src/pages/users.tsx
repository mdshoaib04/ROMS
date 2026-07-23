import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, login } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Plus, UserCog, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Redirect } from "wouter";

const userSchema = z.object({
  name: z.string().min(2, "Name required"),
  username: z.string().min(3, "Username required"),
  password: z.string().min(6, "Min 6 chars").optional().or(z.literal('')),
  email: z.string().email(),
  role: z.enum(["management", "operations", "coordinator", "sales"]),
  phone: z.string().optional()
});

export default function Users() {
  const { role, user } = useAuth();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Only management can view this
  if (role && role !== 'management') return <Redirect to="/dashboard" />;

  const { data: users, isLoading } = useListUsers();
  const createMut = useCreateUser();
  const deleteMut = useDeleteUser();

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    if (confirmUsername !== user?.username) {
      toast({
        title: "Verification Failed",
        description: "Identity verification failed. The entered username does not match your currently logged-in account.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      // Re-verify identity by logging in with username and password
      await login({ username: confirmUsername, password: confirmPassword });
      
      // Verification succeeded. Proceed with user deletion.
      deleteMut.mutate({ id: userToDelete.id }, {
        onSuccess: () => {
          toast({
            title: "User Deleted",
            description: `The user account for "${userToDelete.name}" has been permanently deleted.`
          });
          setDeleteDialogOpen(false);
          setUserToDelete(null);
          setConfirmUsername("");
          setConfirmPassword("");
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        },
        onError: (err: any) => {
          toast({
            title: "Deletion Failed",
            description: err.message || "An error occurred while deleting the user.",
            variant: "destructive",
          });
        }
      });
    } catch (err: any) {
      console.error("Re-authentication failed:", err);
      toast({
        title: "Verification Failed",
        description: "Identity verification failed. Invalid password.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "operations" }
  });

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    if (!values.password) {
      toast({ title: "Error", description: "Password required for new users", variant: "destructive" });
      return;
    }
    
    createMut.mutate({ data: values as any }, {
      onSuccess: () => {
        toast({ title: "User Created" });
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      }
    });
  };

  const getRoleBadge = (r: string) => {
    switch(r) {
      case 'management': return <Badge className="bg-red-900 hover:bg-red-900">Management</Badge>;
      case 'operations': return <Badge className="bg-blue-600 hover:bg-blue-600">Operations</Badge>;
      case 'coordinator': return <Badge className="bg-purple-600 hover:bg-purple-600">Coordinator</Badge>;
      case 'sales': return <Badge className="bg-emerald-600 hover:bg-emerald-600">Sales</Badge>;
      default: return <Badge>{r}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage staff access and roles.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem><FormLabel>Login Username</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="management">Management</SelectItem>
                          <SelectItem value="operations">Operations</SelectItem>
                          <SelectItem value="coordinator">Coordinator</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Initial Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMut.isPending}>
                    {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create User
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right no-print">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-6 w-24 bg-muted animate-pulse rounded-full"></div></TableCell>
                    <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-9 w-9 bg-muted animate-pulse rounded ml-auto"></div></TableCell>
                  </TableRow>
                ))
              ) : (
                users?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{u.username}</TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <span className="text-emerald-600 text-sm font-medium flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Active</span>
                      ) : (
                        <span className="text-muted-foreground text-sm font-medium flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground"></span> Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(u.createdAt), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right no-print">
                      {u.id !== user?.id && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setUserToDelete(u);
                            setConfirmUsername(user?.username || "");
                            setConfirmPassword("");
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm User Deletion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              You are about to permanently delete the account of <strong>{userToDelete?.name}</strong> ({userToDelete?.username}).
            </p>
            <p className="text-sm font-semibold text-destructive">
              This action cannot be undone. To confirm your identity, please enter YOUR own username and password.
            </p>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Your Username</label>
                <Input 
                  value={confirmUsername} 
                  onChange={(e) => setConfirmUsername(e.target.value)} 
                  placeholder="Enter your username"
                  autoComplete="username"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium">Your Password</label>
                <Input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmDelete} 
                disabled={!confirmUsername || !confirmPassword || isVerifying || deleteMut.isPending}
              >
                {(isVerifying || deleteMut.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Delete User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
