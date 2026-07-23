import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useLogout } from "@workspace/api-client-react";
import logo from "@assets/InNews24x7_logo_2022_1784540118747.png";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  FileSpreadsheet, 
  Receipt, 
  Building2, 
  UserCog, 
  Bell,
  LogOut,
  Menu,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const { user, role, logout, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground font-medium">Loading...</span>
      </div>
    </div>
  );

  if (!user) return null;


  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
      }
    });
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["management", "operations", "coordinator", "sales"] },
    { label: "Release Orders", href: "/release-orders", icon: FileText, roles: ["management", "operations", "coordinator", "sales"] },
    { label: "Clients", href: "/clients", icon: Users, roles: ["management", "operations", "sales"] },
    { label: "Playout Reports", href: "/playout-reports", icon: FileSpreadsheet, roles: ["management", "coordinator", "operations"] },
    { label: "Invoices", href: "/invoices", icon: Receipt, roles: ["management", "operations"] },
    { label: "Payments", href: "/payments", icon: Receipt, roles: ["management", "operations"] },
    { label: "Agencies", href: "/agencies", icon: Building2, roles: ["management", "operations"] },
    { label: "Reports", href: "/reports", icon: TrendingUp, roles: ["management", "operations"] },
    { label: "Users", href: "/users", icon: UserCog, roles: ["management"] },
  ];

  const visibleNavItems = navItems.filter(item => role && item.roles.includes(role));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="no-print">
          <SidebarHeader className="bg-sidebar border-b border-sidebar-border h-16 flex items-center justify-center p-4">
            <img src={logo} alt="InNews 24x7" className="h-10 object-contain drop-shadow-md" />
          </SidebarHeader>
          <SidebarContent className="bg-sidebar text-sidebar-foreground">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.startsWith(item.href)}
                        tooltip={item.label}
                      >
                        <Link href={item.href} className="flex items-center gap-3 w-full">
                          <item.icon className="h-4 w-4" />
                          <span className="font-medium tracking-tight">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="bg-sidebar text-sidebar-foreground border-t border-sidebar-border p-4">
            <div className="flex items-center justify-between w-full mb-4 px-2">
              <div className="flex flex-col">
                <span className="text-sm font-semibold truncate w-32">{user.name}</span>
                <span className="text-xs text-sidebar-foreground/60 capitalize">{user.role}</span>
              </div>
              <Link href="/notifications" className="relative text-sidebar-foreground/80 hover:text-white transition-colors">
                <Bell className="h-5 w-5" />
                {/* Simulated unread badge */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                </span>
              </Link>
            </div>
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/80 hover:text-white hover:bg-sidebar-accent" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 border-b bg-card flex items-center px-4 gap-4 lg:hidden no-print sticky top-0 z-10">
            <SidebarTrigger />
            <img src={logo} alt="InNews 24x7" className="h-8 object-contain bg-black px-2 py-1 rounded" />
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
