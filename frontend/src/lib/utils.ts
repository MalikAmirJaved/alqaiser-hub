
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CartLine {
  variant: any;
  qty: number;
  unitPrice: number;
  discountPct: number;
  discountFixed: number;
  taxRate: number;
  notes: string;
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const lineSubtotal = (l: CartLine) => {
  const base = l.qty * l.unitPrice;
  const disc = l.discountFixed > 0 ? l.discountFixed : (base * l.discountPct) / 100;
  return Math.max(0, base - disc);
};
export const lineTax = (l: CartLine) => lineSubtotal(l) * (l.taxRate / 100);
export const lineTotal = (l: CartLine) => lineSubtotal(l) + lineTax(l);
export const cartTotal = (cart: CartLine[]) => cart.reduce((s, l) => s + lineTotal(l), 0);
export const cartSubtotal = (cart: CartLine[]) => cart.reduce((s, l) => s + lineSubtotal(l), 0);
export const cartTax = (cart: CartLine[]) => cart.reduce((s, l) => s + lineTax(l), 0);
