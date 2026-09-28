import { type FormEvent, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCurrentUserQueryKey,
  getGetLoginOptionsQueryKey,
  useGetLoginOptions,
  useLogin,
} from '@workspace/api-client-react';
import {
  ArrowUpLeft,
  Boxes,
  ChartNoAxesCombined,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  ShoppingCart,
  Users,
  WalletCards,
} from 'lucide-react';
import { BrandMark } from '../components/layout/BrandMark';

const loginLogoUrl = `${import.meta.env.BASE_URL}newtech-logo-transparent.png`;

export function LoginPage() {
  const queryClient = useQueryClient();
  const loginOptionsQuery = useGetLoginOptions({
    query: {
      queryKey: getGetLoginOptionsQueryKey(),
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
    },
  });
  const accounts = loginOptionsQuery.data ?? [];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username && accounts.length > 0) {
      setUsername(accounts[0].username);
    }
  }, [accounts, username]);
  
  const login = useLogin({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), data.user);
        setError('');
      },
      onError: () => setError('اسم المستخدم أو كلمة المرور غير صحيحة'),
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    login.mutate({ data: { username, password } });
  };

  return (
    <main className="login-page" dir="rtl">
      <section className="login-showcase">
        <div className="showcase-top">
          <BrandMark />
          <span className="secure-pill"><ShieldCheck /> نظام آمن ومتكامل</span>
        </div>
        <div className="showcase-content">
          <img
            className="login-logo"
            src={loginLogoUrl}
            alt="شعار M3MOPA لأنظمة المراقبة والشبكات"
          />
          <span className="eyebrow">نظام الإدارة المالية والمخزون</span>
          <h1>كل تفاصيل متجرك،<br /><em>في مكان واحد.</em></h1>
          <p>
            إدارة المبيعات والمخزون والحسابات والتوريدات بدقة ووضوح،
            لتبقى أرقام NEWTECH تحت السيطرة في كل لحظة.
          </p>
          <div className="showcase-features">
            <div><WalletCards /><span><b>حسابات دقيقة</b><small>كاش وبنكك ودفتر مالي مترابط</small></span></div>
            <div><Boxes /><span><b>مخزون لحظي</b><small>متابعة الكميات والباركود والأجهزة</small></span></div>
            <div><ChartNoAxesCombined /><span><b>تقارير واضحة</b><small>صورة كاملة عن الأداء والأرباح</small></span></div>
          </div>
        </div>
        <div className="showcase-footer">
          <span>الخرطوم — شارع الستين</span>
          <span>جودة مضمونة • ضمان معتمد • خدمة ما بعد البيع</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="mobile-brand">
          <img
            className="login-logo"
            src={loginLogoUrl}
            alt="شعار M3MOPA لأنظمة المراقبة والشبكات"
          />
        </div>
        <div className="login-card">
          <div className="login-heading">
            <span className="login-icon"><ArrowUpLeft /></span>
            <h2>مرحباً بعودتك</h2>
            <p>سجّل الدخول للوصول إلى نظام NEWTECH</p>
          </div>

          <div className="account-switcher" role="group" aria-label="اختر الحساب">
            {accounts.map((account) => {
              const AccountIcon = account.role === 'admin' ? ShieldCheck : ShoppingCart;
              return (
                <button
                  key={account.username}
                  type="button"
                  className={username === account.username ? 'active' : ''}
                  aria-pressed={username === account.username}
                  onClick={() => setUsername(account.username)}
                >
                  <AccountIcon aria-hidden="true" />
                  <span className="account-option-details">
                    <strong>{account.displayName}</strong>
                    <small>{account.role === 'admin' ? 'المدير' : 'البايع'}</small>
                  </span>
                </button>
              );
            })}
            {loginOptionsQuery.isPending && (
              <div className="account-switcher-status" role="status">
                جاري تحميل الحسابات...
              </div>
            )}
            {loginOptionsQuery.isError && (
              <div className="account-switcher-status" role="status">
                تعذر تحميل الحسابات؛ يمكنك إدخال اسم المستخدم يدويًا.
              </div>
            )}
            {!loginOptionsQuery.isPending && !loginOptionsQuery.isError && accounts.length === 0 && (
              <div className="account-switcher-status" role="status">
                لا توجد حسابات متاحة للاختيار.
              </div>
            )}
          </div>

          <form onSubmit={submit}>
            <label>
              اسم المستخدم
              <div className="field">
                <Users />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="اكتب اسم المستخدم"
                  required
                />
              </div>
            </label>
            <label>
              كلمة المرور
              <div className="field">
                <ShieldCheck />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="أدخل كلمة المرور"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>

            {error && <div className="login-error">{error}</div>}

            <button className="login-submit" disabled={login.isPending || !username.trim() || !password}>
              {login.isPending ? <LoaderCircle className="spin" /> : <ArrowUpLeft />}
              {login.isPending ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="login-note">
            <ShieldCheck />
            <span>كلمة المرور مشفرة والجلسة محمية بتوقيع آمن.</span>
          </div>
        </div>
        <p className="copyright">NEWTECH © 2026 — نظام الإدارة المتكامل</p>
      </section>
    </main>
  );
}
