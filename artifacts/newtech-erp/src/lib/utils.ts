import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatMoney = (value: number | undefined | null) => {
  if (value == null) return "0 SDG";
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} SDG`;
}

export const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  return new Intl.DateTimeFormat('ar-EG', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(d);
}
