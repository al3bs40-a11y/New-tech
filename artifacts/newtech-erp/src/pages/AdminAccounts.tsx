import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminSellersQueryKey,
  getGetCurrentUserQueryKey,
  getGetLoginOptionsQueryKey,
  useDeleteAdminSeller,
  useCreateAdminSeller,
  useGetAdminSellers,
  useUpdateAccountPassword,
  useUpdateAccountProfile,
  useUpdateAdminSeller,
  type AccountPasswordInput,
  type AccountProfileInput,
  type AdminSellerAccount,
  type AuthUser,
  type CreateSellerAccountInput,
} from '@workspace/api-client-react';
import {
  Check,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
  X,
} from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { getApiErrorMessage } from '../lib/apiErrorMessage.ts';
import { createAccountMutationErrorHandlers } from '../lib/accountMutationErrors.ts';

type PasswordFormValues = AccountPasswordInput & { confirmation: string };
type SellerFormValues = CreateSellerAccountInput;

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-SD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function FieldIcon({ children }: { children: ReactNode }) {
  return <span className="accounts-field-icon" aria-hidden="true">{children}</span>;
}

export function AdminAccountsPage({ user }: { user: AuthUser }) {
  const queryClient = useQueryClient();
  const sellersQuery = useGetAdminSellers();
  const sellers = sellersQuery.data ?? [];
  const [editingSeller, setEditingSeller] = useState<AdminSellerAccount | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sellerFeedback, setSellerFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const accountMutationErrorHandlers = createAccountMutationErrorHandlers({
    profile: setProfileFeedback,
    password: setPasswordFeedback,
    createSeller: setSellerFeedback,
    updateSeller: setSellerFeedback,
    deleteSeller: setSellerFeedback,
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showSellerPassword, setShowSellerPassword] = useState(false);

  const profileForm = useForm<AccountProfileInput>({
    defaultValues: { username: user.username, displayName: user.displayName },
  });
  const passwordForm = useForm<PasswordFormValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });
  const sellerForm = useForm<SellerFormValues>({
    defaultValues: { username: '', displayName: '', password: '' },
  });

  useEffect(() => {
    profileForm.reset({ username: user.username, displayName: user.displayName });
  }, [profileForm, user.displayName, user.username]);

  useEffect(() => {
    if (editingSeller) {
      sellerForm.reset({
        username: editingSeller.username,
        displayName: editingSeller.displayName,
        password: '',
      });
      setSellerFeedback(null);
    } else {
      sellerForm.reset({ username: '', displayName: '', password: '' });
    }
  }, [editingSeller, sellerForm]);

  const updateProfile = useUpdateAccountProfile({
    mutation: {
      onMutate: () => {
        setProfileSubmitting(true);
        setProfileFeedback(null);
      },
      onSuccess: (updatedUser) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), updatedUser);
        profileForm.reset({ username: updatedUser.username, displayName: updatedUser.displayName });
        setProfileFeedback({ type: 'success', text: 'تم تحديث بيانات حسابك بنجاح.' });
        setProfileSubmitting(false);
      },
      onError: (error) => {
        accountMutationErrorHandlers.profile(error);
        setProfileSubmitting(false);
      },
    },
  });

  const updatePassword = useUpdateAccountPassword({
    mutation: {
      onSuccess: () => {
        passwordForm.reset();
        setPasswordFeedback({ type: 'success', text: 'تم تغيير كلمة المرور وإنهاء الجلسات القديمة. ستظل هذه الجلسة مفتوحة.' });
      },
      onError: accountMutationErrorHandlers.password,
    },
  });

  const createSeller = useCreateAdminSeller({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSellersQueryKey() });
        sellerForm.reset();
        setSellerFeedback({ type: 'success', text: 'تم إنشاء حساب البايع وإضافته إلى القائمة.' });
      },
      onError: accountMutationErrorHandlers.createSeller,
    },
  });

  const deleteSeller = useDeleteAdminSeller({
    mutation: {
      onSuccess: (_result, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSellersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLoginOptionsQueryKey() });
        if (editingSeller?.id === variables.id) {
          setEditingSeller(null);
        }
        setSellerFeedback({
          type: 'success',
          text: 'تم حذف الحساب مع الإبقاء على سجلاته السابقة.',
        });
      },
      onError: accountMutationErrorHandlers.deleteSeller,
    },
  });

  const updateSeller = useUpdateAdminSeller({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSellersQueryKey() });
        setEditingSeller(null);
        setSellerFeedback({ type: 'success', text: 'تم تحديث بيانات البايع بنجاح.' });
      },
      onError: accountMutationErrorHandlers.updateSeller,
    },
  });

  const submitProfile = (values: AccountProfileInput) => {
    updateProfile.mutate({ data: values });
  };

  const submitPassword = (values: PasswordFormValues) => {
    setPasswordFeedback(null);
    if (values.newPassword !== values.confirmation) {
      passwordForm.setError('confirmation', { type: 'validate', message: 'تأكيد كلمة المرور غير مطابق.' });
      return;
    }
    const data: AccountPasswordInput = {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    };
    updatePassword.mutate({ data });
  };

  const submitSeller = (values: SellerFormValues) => {
    setSellerFeedback(null);
    if (editingSeller) {
      updateSeller.mutate({
        id: editingSeller.id,
        data: { username: values.username, displayName: values.displayName },
      });
      return;
    }
    createSeller.mutate({ data: values });
  };

  const cancelSellerEdit = () => {
    setEditingSeller(null);
    setSellerFeedback(null);
  };

  const confirmDeleteSeller = (seller: AdminSellerAccount) => {
    const confirmed = window.confirm(
      `سيُحذف حساب «${seller.displayName}» ويُمنع صاحبه من الدخول. ستبقى سجلات العمليات السابقة محفوظة باسمه. هل تريد المتابعة؟`,
    );
    if (!confirmed) return;
    setSellerFeedback(null);
    deleteSeller.mutate({ id: seller.id });
  };

  return (
    <div className="accounts-page" dir="rtl">
      <style>{`
        .accounts-page { color: #342d38; }
        .accounts-header { align-items: flex-start; }
        .accounts-heading { display: flex; align-items: flex-start; gap: 15px; }
        .accounts-heading-mark { width: 48px; height: 48px; flex: none; display: grid; place-items: center; border-radius: 14px; color: #6b3188; background: #efe5f4; }
        .accounts-heading-mark svg { width: 23px; }
        .accounts-page .page-title-row h1 { margin-top: 3px; }
        .accounts-page .page-title-row p { max-width: 570px; line-height: 1.7; }
        .accounts-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
        .accounts-card { background: #fff; border: 1px solid #ebe7ec; border-radius: 16px; padding: 22px; box-shadow: 0 6px 22px rgb(67 42 76 / .035); }
        .accounts-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; padding-bottom: 18px; margin-bottom: 19px; border-bottom: 1px solid #f0ecf1; }
        .accounts-card-heading h2 { display: flex; align-items: center; gap: 9px; margin: 0 0 5px; color: #352a3b; font-size: 16px; font-weight: 800; }
        .accounts-card-heading h2 svg { width: 18px; color: #754093; }
        .accounts-card-heading p { margin: 0; color: #958a9a; font-size: 11px; line-height: 1.6; }
        .accounts-role { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; border-radius: 999px; padding: 6px 9px; color: #317c53; background: #e7f5ec; font-size: 10px; font-weight: 800; }
        .accounts-role svg { width: 13px; }
        .accounts-form { display: flex; flex-direction: column; gap: 15px; }
        .accounts-form .form-item { display: flex; flex-direction: column; gap: 7px; }
        .accounts-form label { color: #4a414e; font-size: 12px; font-weight: 800; }
        .accounts-input-wrap { position: relative; display: flex; align-items: center; }
        .accounts-input { width: 100%; height: 45px; border: 1px solid #dcd7df; border-radius: 10px; padding: 0 40px 0 13px; outline: 0; color: #2a232d; background: #fff; font-size: 13px; transition: .2s; }
        .accounts-input:focus { border-color: #8447a4; box-shadow: 0 0 0 3px rgb(132 71 164 / .14); }
        .accounts-input::placeholder { color: #b0a8b3; }
        .accounts-field-icon { position: absolute; right: 13px; z-index: 1; display: grid; place-items: center; color: #a69ca9; pointer-events: none; }
        .accounts-field-icon svg { width: 17px; }
        .accounts-password-input { padding-left: 43px; }
        .accounts-password-toggle { position: absolute; left: 6px; width: 33px; height: 33px; display: grid; place-items: center; border: 0; border-radius: 8px; color: #8a7f8f; background: transparent; }
        .accounts-password-toggle:hover { color: #642881; background: #f7f0fa; }
        .accounts-password-toggle svg { width: 17px; }
        .accounts-form .form-description { color: #a098a3; font-size: 10px; line-height: 1.55; margin: 0; }
        .accounts-form [role="alert"] { color: #b42318; font-size: 11px; font-weight: 600; margin: -3px 0 0; }
        .accounts-submit-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 3px; }
        .accounts-submit { min-height: 42px; border: 0; border-radius: 10px; padding: 0 16px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; color: #fff; background: #642881; font-size: 12px; font-weight: 800; box-shadow: 0 6px 16px rgb(100 40 129 / .14); transition: transform .2s, box-shadow .2s, opacity .2s; }
        .accounts-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgb(100 40 129 / .22); }
        .accounts-submit:disabled { cursor: wait; opacity: .58; }
        .accounts-submit svg { width: 16px; }
        .accounts-feedback { display: flex; align-items: flex-start; gap: 8px; border-radius: 10px; padding: 10px 12px; font-size: 11px; line-height: 1.55; }
        .accounts-feedback.success { color: #287149; border: 1px solid #ccebd7; background: #f0faf3; }
        .accounts-feedback.error { color: #a22c26; border: 1px solid #f0cbc7; background: #fff4f2; }
        .accounts-feedback svg { width: 16px; flex: none; margin-top: 1px; }
        .seller-section { grid-column: 1 / -1; }
        .seller-section-heading { align-items: center; }
        .seller-count { display: inline-flex; min-width: 27px; height: 25px; align-items: center; justify-content: center; padding: 0 8px; border-radius: 999px; color: #6d318d; background: #f0e7f5; font: 800 12px Arial, sans-serif; }
        .seller-workspace { display: grid; grid-template-columns: minmax(280px, .72fr) minmax(0, 1.28fr); gap: 25px; }
        .seller-form-pane { padding-left: 25px; border-left: 1px solid #f0ecf1; }
        .seller-form-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
        .seller-form-title h3 { margin: 0; color: #493c50; font-size: 14px; font-weight: 800; }
        .seller-form-title small { color: #a098a3; font-size: 10px; }
        .seller-cancel { border: 1px solid #e3dce6; background: #fff; color: #735f7d; border-radius: 8px; padding: 6px 9px; display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; }
        .seller-cancel svg { width: 13px; }
        .seller-list-pane { min-width: 0; }
        .seller-list-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; color: #8c818f; font-size: 11px; font-weight: 700; }
        .seller-list { display: flex; flex-direction: column; gap: 6px; }
        .seller-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 13px; align-items: center; padding: 11px 12px; border: 1px solid #f0ecf1; border-radius: 11px; transition: border-color .18s, background .18s; }
        .seller-row:hover { border-color: #dfd0e5; background: #fdfbfe; }
        .seller-identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .seller-avatar { width: 34px; height: 34px; display: grid; place-items: center; flex: none; border-radius: 10px; color: #6d318d; background: #f0e7f5; font-weight: 900; }
        .seller-identity strong, .seller-identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .seller-identity strong { color: #3f3346; font-size: 12px; font-weight: 800; }
        .seller-identity small { margin-top: 3px; color: #9b919f; font-size: 10px; direction: ltr; text-align: right; }
        .seller-date { color: #9e959f; font-size: 10px; white-space: nowrap; }
        .seller-edit { width: 31px; height: 31px; display: grid; place-items: center; border: 1px solid #e6deea; border-radius: 8px; color: #6f3290; background: #fff; }
        .seller-edit:hover { background: #f7f0fa; border-color: #d5c3dc; }
        .seller-edit svg { width: 15px; }
        .seller-actions { display: flex; align-items: center; gap: 6px; }
        .seller-delete { width: 31px; height: 31px; display: grid; place-items: center; border: 1px solid #f0d6d3; border-radius: 8px; color: #b42318; background: #fff; }
        .seller-delete:hover:not(:disabled) { background: #fff4f2; border-color: #e8b9b4; }
        .seller-delete:disabled { cursor: wait; opacity: .6; }
        .seller-delete svg { width: 15px; }
        .accounts-empty { min-height: 170px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 1px dashed #ded6e1; border-radius: 12px; color: #978d9d; font-size: 12px; text-align: center; }
        .accounts-empty svg { width: 27px; color: #ad9cba; }
        .accounts-skeleton { min-height: 170px; border-radius: 12px; background: linear-gradient(90deg, #faf8fb 25%, #f0ebf3 50%, #faf8fb 75%); background-size: 200% 100%; animation: accounts-shimmer 1.4s ease-in-out infinite; }
        @keyframes accounts-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .accounts-query-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 100px; padding: 16px; border-radius: 12px; background: #fff4f2; border: 1px solid #f0cbc7; color: #a22c26; font-size: 12px; }
        .accounts-refresh { flex: none; border: 1px solid #e6c6c2; background: #fff; color: #9c3830; border-radius: 8px; padding: 8px 10px; display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; }
        .accounts-refresh svg { width: 14px; }
        .accounts-page button:focus-visible, .accounts-page input:focus-visible { outline: 3px solid rgb(132 71 164 / .22); outline-offset: 2px; }
        @media (max-width: 900px) {
          .accounts-layout { grid-template-columns: 1fr; }
          .seller-section { grid-column: auto; }
          .seller-workspace { grid-template-columns: 1fr; gap: 22px; }
          .seller-form-pane { padding-left: 0; padding-bottom: 22px; border-left: 0; border-bottom: 1px solid #f0ecf1; }
        }
        @media (max-width: 560px) {
          .accounts-card { padding: 17px; }
          .accounts-heading { gap: 10px; }
          .accounts-heading-mark { width: 42px; height: 42px; border-radius: 12px; }
          .accounts-heading-mark svg { width: 20px; }
          .accounts-card-heading { gap: 8px; }
          .accounts-role { padding-inline: 7px; }
          .seller-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
          .seller-date { display: none; }
          .accounts-submit-row { align-items: stretch; flex-direction: column; }
          .accounts-submit { width: 100%; }
        }
      `}</style>

      <div className="page-title-row accounts-header">
        <div className="accounts-heading">
          <span className="accounts-heading-mark"><UserCog /></span>
          <div>
            <span className="page-kicker">الإدارة والوصول</span>
            <h1>الحسابات والصلاحيات</h1>
            <p>حدّث بيانات دخولك وأدر حسابات الباعة من مكان واحد، مع إبقاء كلمات المرور تحت سيطرة صاحب النظام.</p>
          </div>
        </div>
      </div>

      <div className="accounts-layout">
        <section className="accounts-card" aria-labelledby="profile-heading">
          <div className="accounts-card-heading">
            <div>
              <h2 id="profile-heading"><UserCog /> بيانات حسابي</h2>
              <p>الاسم الظاهر واسم المستخدم اللذان يظهران داخل النظام.</p>
            </div>
            <span className="accounts-role"><ShieldCheck /> مدير النظام</span>
          </div>

          <Form {...profileForm}>
            <form className="accounts-form" onSubmit={profileForm.handleSubmit(submitProfile)}>
              <FormField
                control={profileForm.control}
                name="displayName"
                rules={{
                  required: 'الاسم الظاهر مطلوب.',
                  minLength: { value: 2, message: 'اكتب اسمين على الأقل.' },
                  maxLength: { value: 100, message: 'الاسم الظاهر طويل جداً.' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم الظاهر</FormLabel>
                    <div className="accounts-input-wrap">
                      <FieldIcon><UserCog /></FieldIcon>
                      <FormControl>
                        <input {...field} className="accounts-input" data-testid="input-profile-display-name" placeholder="مثال: مدير NEWTECH" autoComplete="name" />
                      </FormControl>
                    </div>
                    <FormMessage data-testid="message-profile-display-name" />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="username"
                rules={{
                  required: 'اسم المستخدم مطلوب.',
                  minLength: { value: 3, message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.' },
                  maxLength: { value: 60, message: 'اسم المستخدم طويل جداً.' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المستخدم</FormLabel>
                    <div className="accounts-input-wrap">
                      <FieldIcon><KeyRound /></FieldIcon>
                      <FormControl>
                        <input {...field} className="accounts-input" data-testid="input-profile-username" placeholder="اسم الدخول" dir="ltr" autoComplete="username" />
                      </FormControl>
                    </div>
                    <FormDescription className="form-description">يُستخدم هذا الاسم عند تسجيل الدخول، ولا يغيّر دورك كمدير.</FormDescription>
                    <FormMessage data-testid="message-profile-username" />
                  </FormItem>
                )}
              />
              {profileFeedback && (
                <div className={`accounts-feedback ${profileFeedback.type}`} role={profileFeedback.type === 'error' ? 'alert' : 'status'} aria-live="polite" data-testid={`status-profile-${profileFeedback.type}`}>
                  {profileFeedback.type === 'success' ? <Check /> : <X />}
                  <span>{profileFeedback.text}</span>
                </div>
              )}
              <div className="accounts-submit-row">
                <span className="form-description">آخر تحديث ينعكس فوراً في الشريط العلوي.</span>
                <button type="submit" className="accounts-submit" data-testid="button-save-profile" disabled={profileSubmitting || updateProfile.isPending}>
                  {profileSubmitting || updateProfile.isPending ? <LoaderCircle className="spin" /> : <Check />}
                  {profileSubmitting || updateProfile.isPending ? 'جاري الحفظ...' : 'حفظ بيانات الحساب'}
                </button>
              </div>
            </form>
          </Form>
        </section>

        <section className="accounts-card" aria-labelledby="password-heading">
          <div className="accounts-card-heading">
            <div>
              <h2 id="password-heading"><LockKeyhole /> تغيير كلمة المرور</h2>
              <p>يلزم إدخال كلمة المرور الحالية قبل اعتماد كلمة جديدة.</p>
            </div>
          </div>

          <Form {...passwordForm}>
            <form className="accounts-form" onSubmit={passwordForm.handleSubmit(submitPassword)}>
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                rules={{ required: 'أدخل كلمة المرور الحالية.' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور الحالية</FormLabel>
                    <div className="accounts-input-wrap">
                      <FieldIcon><LockKeyhole /></FieldIcon>
                      <FormControl>
                        <input {...field} type={showCurrentPassword ? 'text' : 'password'} className="accounts-input accounts-password-input" data-testid="input-current-password" autoComplete="current-password" placeholder="كلمة المرور الحالية" />
                      </FormControl>
                      <button type="button" className="accounts-password-toggle" data-testid="button-toggle-current-password" onClick={() => setShowCurrentPassword((value) => !value)} aria-label={showCurrentPassword ? 'إخفاء كلمة المرور الحالية' : 'إظهار كلمة المرور الحالية'}>
                        {showCurrentPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                    <FormMessage data-testid="message-current-password" />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                rules={{
                  required: 'أدخل كلمة المرور الجديدة.',
                  minLength: { value: 8, message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' },
                  maxLength: { value: 128, message: 'كلمة المرور طويلة جداً.' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور الجديدة</FormLabel>
                    <div className="accounts-input-wrap">
                      <FieldIcon><KeyRound /></FieldIcon>
                      <FormControl>
                        <input {...field} type={showNewPassword ? 'text' : 'password'} className="accounts-input accounts-password-input" data-testid="input-new-password" autoComplete="new-password" placeholder="8 أحرف على الأقل" />
                      </FormControl>
                      <button type="button" className="accounts-password-toggle" data-testid="button-toggle-new-password" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? 'إخفاء كلمة المرور الجديدة' : 'إظهار كلمة المرور الجديدة'}>
                        {showNewPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                    <FormMessage data-testid="message-new-password" />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmation"
                rules={{ required: 'أكد كلمة المرور الجديدة.' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تأكيد كلمة المرور الجديدة</FormLabel>
                    <div className="accounts-input-wrap">
                      <FieldIcon><ShieldCheck /></FieldIcon>
                      <FormControl>
                        <input {...field} type="password" className="accounts-input" data-testid="input-confirm-password" autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" />
                      </FormControl>
                    </div>
                    <FormMessage data-testid="message-confirm-password" />
                  </FormItem>
                )}
              />
              {passwordFeedback && (
                <div className={`accounts-feedback ${passwordFeedback.type}`} role={passwordFeedback.type === 'error' ? 'alert' : 'status'} aria-live="polite" data-testid={`status-password-${passwordFeedback.type}`}>
                  {passwordFeedback.type === 'success' ? <Check /> : <X />}
                  <span>{passwordFeedback.text}</span>
                </div>
              )}
              <div className="accounts-submit-row">
                <span className="form-description">لا تشارك كلمة المرور مع أي مستخدم آخر.</span>
                <button type="submit" className="accounts-submit" data-testid="button-change-password" disabled={updatePassword.isPending}>
                  {updatePassword.isPending ? <LoaderCircle className="spin" /> : <LockKeyhole />}
                  {updatePassword.isPending ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </form>
          </Form>
        </section>

        <section className="accounts-card seller-section" aria-labelledby="sellers-heading">
          <div className="accounts-card-heading seller-section-heading">
            <div>
              <h2 id="sellers-heading"><UsersRound /> حسابات الباعة <span className="seller-count" data-testid="text-seller-count">{sellers.length}</span></h2>
              <p>أنشئ حسابات دخول للباعة وعدّل أسماءهم وبياناتهم الأساسية دون تغيير أدوارهم.</p>
            </div>
            <span className="accounts-role"><ShieldCheck /> إدارة المدير فقط</span>
          </div>

          <div className="seller-workspace">
            <div className="seller-form-pane">
              <div className="seller-form-title">
                <div>
                  <h3>{editingSeller ? 'تعديل حساب البايع' : 'إضافة بايع جديد'}</h3>
                  <small>{editingSeller ? `تعديل: ${editingSeller.displayName}` : 'كلمة المرور مطلوبة عند الإنشاء فقط'}</small>
                </div>
                {editingSeller && (
                  <button type="button" className="seller-cancel" data-testid="button-cancel-seller-edit" onClick={cancelSellerEdit}>
                    <X /> إلغاء التعديل
                  </button>
                )}
              </div>
              <Form {...sellerForm}>
                <form className="accounts-form" onSubmit={sellerForm.handleSubmit(submitSeller)}>
                  <FormField
                    control={sellerForm.control}
                    name="displayName"
                    rules={{
                      required: 'الاسم الظاهر مطلوب.',
                      minLength: { value: 2, message: 'اكتب اسمين على الأقل.' },
                      maxLength: { value: 100, message: 'الاسم الظاهر طويل جداً.' },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الاسم الظاهر</FormLabel>
                        <div className="accounts-input-wrap">
                          <FieldIcon><UserCog /></FieldIcon>
                          <FormControl>
                            <input {...field} className="accounts-input" data-testid="input-seller-display-name" placeholder="مثال: محمد أحمد" autoComplete="name" />
                          </FormControl>
                        </div>
                        <FormMessage data-testid="message-seller-display-name" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={sellerForm.control}
                    name="username"
                    rules={{
                      required: 'اسم المستخدم مطلوب.',
                      minLength: { value: 3, message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.' },
                      maxLength: { value: 60, message: 'اسم المستخدم طويل جداً.' },
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم المستخدم</FormLabel>
                        <div className="accounts-input-wrap">
                          <FieldIcon><KeyRound /></FieldIcon>
                          <FormControl>
                            <input {...field} className="accounts-input" data-testid="input-seller-username" placeholder="اسم الدخول للبايع" dir="ltr" autoComplete="username" />
                          </FormControl>
                        </div>
                        <FormMessage data-testid="message-seller-username" />
                      </FormItem>
                    )}
                  />
                  {!editingSeller && (
                    <FormField
                      control={sellerForm.control}
                      name="password"
                      rules={{
                        required: 'كلمة المرور الابتدائية مطلوبة.',
                        minLength: { value: 8, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' },
                        maxLength: { value: 128, message: 'كلمة المرور طويلة جداً.' },
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>كلمة المرور الابتدائية</FormLabel>
                          <div className="accounts-input-wrap">
                            <FieldIcon><LockKeyhole /></FieldIcon>
                            <FormControl>
                              <input {...field} type={showSellerPassword ? 'text' : 'password'} className="accounts-input accounts-password-input" data-testid="input-seller-password" autoComplete="new-password" placeholder="8 أحرف على الأقل" />
                            </FormControl>
                            <button type="button" className="accounts-password-toggle" data-testid="button-toggle-seller-password" onClick={() => setShowSellerPassword((value) => !value)} aria-label={showSellerPassword ? 'إخفاء كلمة المرور الابتدائية' : 'إظهار كلمة المرور الابتدائية'}>
                              {showSellerPassword ? <EyeOff /> : <Eye />}
                            </button>
                          </div>
                          <FormMessage data-testid="message-seller-password" />
                        </FormItem>
                      )}
                    />
                  )}
                  {sellerFeedback && (
                    <div className={`accounts-feedback ${sellerFeedback.type}`} role={sellerFeedback.type === 'error' ? 'alert' : 'status'} aria-live="polite" data-testid={`status-seller-${sellerFeedback.type}`}>
                      {sellerFeedback.type === 'success' ? <Check /> : <X />}
                      <span>{sellerFeedback.text}</span>
                    </div>
                  )}
                  <button type="submit" className="accounts-submit" data-testid={editingSeller ? 'button-save-seller-edit' : 'button-create-seller'} disabled={createSeller.isPending || updateSeller.isPending}>
                    {createSeller.isPending || updateSeller.isPending ? <LoaderCircle className="spin" /> : editingSeller ? <Check /> : <Plus />}
                    {createSeller.isPending || updateSeller.isPending ? 'جاري الحفظ...' : editingSeller ? 'حفظ تعديلات البايع' : 'إنشاء حساب البايع'}
                  </button>
                </form>
              </Form>
            </div>

            <div className="seller-list-pane">
              <div className="seller-list-heading">
                <span>الباعة المسجلون</span>
                {sellers.length > 0 && <span>{sellers.length === 1 ? 'حساب واحد' : `${sellers.length} حسابات`}</span>}
              </div>
              {sellersQuery.isPending ? (
                <div className="accounts-skeleton" aria-label="جاري تحميل حسابات الباعة" data-testid="status-sellers-loading" />
              ) : sellersQuery.isError ? (
                <div className="accounts-query-error" role="alert" data-testid="status-sellers-error">
                  <span>{getApiErrorMessage(sellersQuery.error, 'تعذر تحميل حسابات الباعة من الخادم.')}</span>
                  <button type="button" className="accounts-refresh" data-testid="button-retry-sellers" onClick={() => sellersQuery.refetch()}>
                    <RefreshCw /> إعادة المحاولة
                  </button>
                </div>
              ) : sellers.length === 0 ? (
                <div className="accounts-empty" data-testid="status-sellers-empty">
                  <UsersRound />
                  <strong>لا توجد حسابات باعة بعد</strong>
                  <span>ابدأ بإنشاء أول حساب من النموذج.</span>
                </div>
              ) : (
                <div className="seller-list" role="list" data-testid="list-sellers">
                  {sellers.map((seller) => (
                    <div className="seller-row" role="listitem" key={seller.id} data-testid={`row-seller-${seller.id}`}>
                      <div className="seller-identity">
                        <span className="seller-avatar" aria-hidden="true">{seller.displayName.charAt(0)}</span>
                        <div>
                          <strong data-testid={`text-seller-display-name-${seller.id}`}>{seller.displayName}</strong>
                          <small data-testid={`text-seller-username-${seller.id}`}>{seller.username}</small>
                        </div>
                      </div>
                      <span className="seller-date" data-testid={`text-seller-created-${seller.id}`}>{formatCreatedAt(seller.createdAt)}</span>
                      <div className="seller-actions">
                        <button type="button" className="seller-edit" data-testid={`button-edit-seller-${seller.id}`} onClick={() => setEditingSeller(seller)} aria-label={`تعديل حساب ${seller.displayName}`}>
                          <Edit3 />
                        </button>
                        <button
                          type="button"
                          className="seller-delete"
                          data-testid={`button-delete-seller-${seller.id}`}
                          onClick={() => confirmDeleteSeller(seller)}
                          disabled={deleteSeller.isPending}
                          aria-label={`حذف حساب ${seller.displayName}`}
                        >
                          {deleteSeller.isPending ? <LoaderCircle className="spin" /> : <Trash2 />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}