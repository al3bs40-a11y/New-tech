import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import { AuthGate } from './components/layout/AuthGate';
import { DashboardPage } from './pages/Dashboard';
import { SalesPage } from './pages/Sales';
import { InvoicesPage } from './pages/Invoices';
import { InventoryPage } from './pages/Inventory';
import { ReportsPage } from './pages/Reports';
import { AddProductPage } from './pages/AddProduct';
import { CustomersPage } from './pages/Customers';
import { ExpensesPage } from './pages/Expenses';
import { SettlementsPage } from './pages/Settlements';
import { AdminAccountsPage } from './pages/AdminAccounts';
import { Store } from 'lucide-react';
import { Link } from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function NotFound() {
  return (
    <div className="module-placeholder">
      <Store />
      <h1>الصفحة غير موجودة</h1>
      <p>عذراً، الرابط الذي تحاول الوصول إليه غير موجود.</p>
      <Link href="/" className="primary-action">العودة للرئيسية</Link>
    </div>
  );
}

function SellerRoute({ role, children }: { role: string; children: React.ReactNode }) {
  if (role !== 'seller') {
    return (
      <div className="module-placeholder">
        <Store />
        <h1>عذراً</h1>
        <p>هذه الصفحة مخصصة للبايع.</p>
        <Link href="/" className="primary-action">العودة للرئيسية</Link>
      </div>
    );
  }
  return <>{children}</>;
}

function AdminRoute({ role, children }: { role: string; children: React.ReactNode }) {
  if (role !== 'admin') {
    return (
      <div className="module-placeholder">
        <Store />
        <h1>عذراً</h1>
        <p>هذه الصفحة مخصصة لمدير النظام.</p>
        <Link href="/" className="primary-action">العودة للرئيسية</Link>
      </div>
    );
  }
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <AuthGate>
            {(user) => (
              <Switch>
                <Route path="/" component={() => <DashboardPage role={user.role} />} />
                <Route path="/sales" component={() => <SalesPage role={user.role} />} />
                <Route path="/invoices" component={() => <InvoicesPage role={user.role} />} />
                <Route path="/reports" component={() => <ReportsPage role={user.role} />} />
                <Route path="/inventory" component={() => <InventoryPage role={user.role} />} />
                <Route path="/add-product" component={() => <AddProductPage role={user.role} />} />
                <Route path="/customers" component={() => <CustomersPage role={user.role} />} />
                <Route path="/expenses" component={() => <ExpensesPage />} />
                <Route path="/settlements" component={() => <SellerRoute role={user.role}><SettlementsPage /></SellerRoute>} />
                <Route path="/admin/accounts" component={() => <AdminRoute role={user.role}><AdminAccountsPage user={user} /></AdminRoute>} />
                <Route component={NotFound} />
              </Switch>
            )}
          </AuthGate>
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
