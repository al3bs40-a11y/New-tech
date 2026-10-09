import { getApiErrorMessage } from './apiErrorMessage.ts';

export type AccountMutationFeedback = {
  type: 'success' | 'error';
  text: string;
};

type FeedbackSetter = (feedback: AccountMutationFeedback) => void;

export const ACCOUNT_MUTATION_ERROR_FALLBACKS = {
  profile: 'تعذر تحديث بيانات الحساب. راجع البيانات وحاول مرة أخرى.',
  password: 'تعذر تغيير كلمة المرور. تأكد من كلمة المرور الحالية وحاول مرة أخرى.',
  createSeller: 'تعذر إنشاء الحساب. قد يكون اسم المستخدم مستخدماً من قبل.',
  updateSeller: 'تعذر تحديث بيانات البايع. راجع البيانات وحاول مرة أخرى.',
  deleteSeller: 'تعذر حذف الحساب. حاول مرة أخرى.',
} as const;

export function createAccountMutationErrorHandlers(setters: {
  profile: FeedbackSetter;
  password: FeedbackSetter;
  createSeller: FeedbackSetter;
  updateSeller: FeedbackSetter;
  deleteSeller: FeedbackSetter;
}) {
  const createHandler = (setter: FeedbackSetter, fallback: string) => (error: unknown) => {
    setter({ type: 'error', text: getApiErrorMessage(error, fallback) });
  };

  return {
    profile: createHandler(setters.profile, ACCOUNT_MUTATION_ERROR_FALLBACKS.profile),
    password: createHandler(setters.password, ACCOUNT_MUTATION_ERROR_FALLBACKS.password),
    createSeller: createHandler(setters.createSeller, ACCOUNT_MUTATION_ERROR_FALLBACKS.createSeller),
    updateSeller: createHandler(setters.updateSeller, ACCOUNT_MUTATION_ERROR_FALLBACKS.updateSeller),
    deleteSeller: createHandler(setters.deleteSeller, ACCOUNT_MUTATION_ERROR_FALLBACKS.deleteSeller),
  };
}
