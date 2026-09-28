import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCurrentUserQueryKey, useLogout } from '@workspace/api-client-react';
import {
  Bell,
  Boxes,
  FileText,
  FileBadge2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  PackagePlus,
  ReceiptText,
  Search,
  ShoppingCart,
  Users,
  UserCog,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BrandMark } from './BrandMark';

const navItems: {
  label: string;
  path: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  sellerOnly?: boolean;
}[] = [
  { label: 'لوحة التحكم', path: '/', icon: LayoutDashboard },
  { label: 'المبيعات', path: '/sales', icon: ShoppingCart },
  { label: 'الفواتير', path: '/invoices', icon: FileText },
  { label: 'التقارير', path: '/reports', icon: FileBadge2 },
  { label: 'المخزون', path: '/inventory', icon: Boxes },
  { label: 'إضافة بضاعة', path: '/add-product', icon: PackagePlus },
  { label: 'العملاء', path: '/customers', icon: Users },
  { label: 'المصروفات', path: '/expenses', icon: ReceiptText },
  { label: 'توريد الحصيلة', path: '/settlements', icon: WalletCards, sellerOnly: true },
  { label: 'الحسابات', path: '/admin/accounts', icon: UserCog, adminOnly: true },
];

export function AppShell({
  user,
  children
}: {
  user: { displayName: string; username: string; role: string };
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== '/api/auth/me',
        });
        queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
      },
    },
  });
  
  const visibleNav = navItems.filter(
    (item) =>
      (!item.adminOnly || user.role === 'admin') &&
      (!item.sellerOnly || user.role === 'seller'),
  );

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="app-shell" dir="rtl">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-brand">
          <BrandMark compact />
          <button
            className="mobile-sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X />
          </button>
        </div>
        <nav>
          <span className="nav-label">القائمة الرئيسية</span>
          {visibleNav.map(({ label, path, icon: Icon }) => {
            const isActive = location === path || (path !== '/' && location.startsWith(path));
            return (
              <Link
                key={label}
                href={path}
                className={isActive ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                <Icon /><span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{user.displayName.charAt(0)}</span>
          <div>
            <b>{user.displayName}</b>
            <small>{user.role === 'admin' ? 'مدير النظام' : 'البايع'}</small>
          </div>
          <button
            onClick={() => logout.mutate()}
            aria-label="تسجيل الخروج"
            disabled={logout.isPending}
          >
            {logout.isPending ? <LoaderCircle className="spin" /> : <LogOut />}
          </button>
        </div>
      </aside>
      
      {menuOpen && <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <div className="main-column">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)}>
            <Menu />
          </button>
          <div className="global-search">
            <Search />
            <input placeholder="بحث برقم الفاتورة أو العميل..." />
          </div>
          <div className="topbar-actions">
            <button className="icon-button"><Bell /><span /></button>
            <div className="top-user">
              <span className="avatar">{user.displayName.charAt(0)}</span>
              <div>
                <b>{user.displayName}</b>
                <small>{user.role === 'admin' ? 'مدير النظام' : 'البايع'}</small>
              </div>
            </div>
            <button
              className="topbar-logout"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {logout.isPending ? <LoaderCircle className="spin" /> : <LogOut />}
              <span>{logout.isPending ? 'جاري الخروج...' : 'تسجيل الخروج'}</span>
            </button>
          </div>
        </header>
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
