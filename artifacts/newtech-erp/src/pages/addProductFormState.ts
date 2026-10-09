import { getApiErrorMessage } from '../lib/apiErrorMessage.ts';

export interface AddProductFormData {
  name: string;
  category: string;
  brand: string;
  model: string;
  specification: string;
  unit: string;
  quantity: number | string;
  price: number | string;
  payable: number | string;
  imei: string;
  serialNumber: string;
}

export interface AddProductFormState {
  formData: AddProductFormData;
  error: string;
  notice: string;
}

type AddProductFormAction =
  | { type: 'fieldChanged'; name: string; value: string }
  | { type: 'submissionStarted' }
  | { type: 'creationFailed'; serverError: unknown }
  | { type: 'creationSucceeded'; notice: string };

export const initialAddProductFormState: AddProductFormState = {
  formData: {
    name: '',
    category: '',
    brand: '',
    model: '',
    specification: '',
    unit: 'قطعة',
    quantity: 1,
    price: 0,
    payable: 0,
    imei: '',
    serialNumber: '',
  },
  error: '',
  notice: '',
};

const fallbackErrorMessage =
  'حدث خطأ أثناء إضافة المنتج. تأكد من صحة البيانات.';

export function getProductCreateErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, fallbackErrorMessage);
}

export function addProductFormReducer(
  state: AddProductFormState,
  action: AddProductFormAction,
): AddProductFormState {
  switch (action.type) {
    case 'fieldChanged':
      return {
        ...state,
        formData: { ...state.formData, [action.name]: action.value },
      };
    case 'submissionStarted':
      return { ...state, error: '', notice: '' };
    case 'creationFailed':
      return { ...state, error: getProductCreateErrorMessage(action.serverError) };
    case 'creationSucceeded':
      return { ...state, notice: action.notice };
  }
}
