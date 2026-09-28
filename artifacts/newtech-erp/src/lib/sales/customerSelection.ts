export interface CustomerOption {
  name: string;
  phone: string;
}

export interface CustomerSelection {
  phone: string;
  autoMatchedPhone: string | null;
}

export function normalizeSudanPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local =
    digits.startsWith("249") && digits.length === 12
      ? `0${digits.slice(3)}`
      : digits.length === 9 && digits.startsWith("9")
        ? `0${digits}`
        : digits;
  return /^0\d{9}$/.test(local) ? local : "";
}

export function findCustomerByPhone(
  phone: string,
  customers: CustomerOption[] | undefined,
): CustomerOption | undefined {
  const normalizedPhone = normalizeSudanPhone(phone);
  if (!normalizedPhone) return undefined;
  return customers?.find(
    (customer) => normalizeSudanPhone(customer.phone) === normalizedPhone,
  );
}

export function updateCustomerSelection(
  name: string,
  customers: CustomerOption[] | undefined,
  currentPhone: string,
  previousAutoMatchedPhone: string | null,
): CustomerSelection {
  const customer = customers?.find(
    (item) => item.name.trim() === name.trim(),
  );
  if (customer) {
    return {
      phone: customer.phone,
      autoMatchedPhone: customer.phone,
    };
  }

  return {
    phone:
      previousAutoMatchedPhone && currentPhone === previousAutoMatchedPhone
        ? ""
        : currentPhone,
    autoMatchedPhone: null,
  };
}