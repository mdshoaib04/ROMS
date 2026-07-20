import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from './context/AuthContext';
import { Shell } from './components/layout/Shell';

import Login from './pages/login';
import Dashboard from './pages/dashboard';
import ReleaseOrders from './pages/release-orders';
import ReleaseOrderNew from './pages/release-orders/new';
import ReleaseOrderDetail from './pages/release-orders/detail';
import Clients from './pages/clients';
import ClientNew from './pages/clients/new';
import ClientDetail from './pages/clients/detail';
import PlayoutReports from './pages/playout-reports';
import PlayoutReportNew from './pages/playout-reports/new';
import PlayoutReportDetail from './pages/playout-reports/detail';
import Invoices from './pages/invoices';
import InvoiceNew from './pages/invoices/new';
import InvoiceDetail from './pages/invoices/detail';
import Payments from './pages/payments';
import Agencies from './pages/agencies';
import Users from './pages/users';
import Notifications from './pages/notifications';

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, ...rest }: any) {
  return (
    <Shell>
      <Component {...rest} />
    </Shell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      
      <Route path="/release-orders/new" component={() => <ProtectedRoute component={ReleaseOrderNew} />} />
      <Route path="/release-orders/:id" component={(params) => <ProtectedRoute component={ReleaseOrderDetail} id={params.id} />} />
      <Route path="/release-orders" component={() => <ProtectedRoute component={ReleaseOrders} />} />
      
      <Route path="/clients/new" component={() => <ProtectedRoute component={ClientNew} />} />
      <Route path="/clients/:id" component={(params) => <ProtectedRoute component={ClientDetail} id={params.id} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      
      <Route path="/playout-reports/new" component={() => <ProtectedRoute component={PlayoutReportNew} />} />
      <Route path="/playout-reports/:id" component={(params) => <ProtectedRoute component={PlayoutReportDetail} id={params.id} />} />
      <Route path="/playout-reports" component={() => <ProtectedRoute component={PlayoutReports} />} />
      
      <Route path="/invoices/new" component={() => <ProtectedRoute component={InvoiceNew} />} />
      <Route path="/invoices/:id" component={(params) => <ProtectedRoute component={InvoiceDetail} id={params.id} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      
      <Route path="/payments" component={() => <ProtectedRoute component={Payments} />} />
      <Route path="/agencies" component={() => <ProtectedRoute component={Agencies} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
