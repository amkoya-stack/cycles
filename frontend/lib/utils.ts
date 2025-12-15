import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(amount: number | null | undefined): string {
  // Handle null/undefined/invalid values
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0";
  }

  if (amount >= 1000) {
    const thousands = amount / 1000;
    // Remove trailing zeros after decimal
    return `${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`;
  }
  return amount.toString();
}

export function formatFrequency(frequency: string | null | undefined): string {
  if (!frequency) {
    return "—";
  }

  const freqMap: Record<string, string> = {
    daily: "day",
    weekly: "wk",
    biweekly: "2wk",
    monthly: "mo",
    custom: "custom",
  };
  return freqMap[frequency.toLowerCase()] || frequency.slice(0, 2);
}
