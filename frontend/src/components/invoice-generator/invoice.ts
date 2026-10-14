import { z } from "zod";
import { getLocale, type InvoiceLocale } from "./locales";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  discountAmount?: number;
  taxRate?: number;
}

export interface Party {
  name: string;
  email: string;
  address: string;
  phone: string;
  taxId: string;
  /** Second tax identifier (STRN, extra VAT number, etc.) */
  taxIdSecondary: string;
}

export interface InvoiceData {
  templateSlug: string;
  /** Country preset such as "pakistan". Drives NTN/STRN labels in preview + PDF. */
  localeSlug: string | null;
  /** Overrides the template accent when set (hex, e.g. #2563eb) */
  accentColor: string | null;
  currency: string;
  logo: string | null;
  signature: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  from: Party;
  to: Party;
  items: LineItem[];
  financialBreakdown?: {
    lineDiscountTotal: number;
    lineTaxTotal: number;
    overallDiscountPercent: number;
    overallDiscountAmount: number;
    overallTaxPercent: number;
    overallTaxAmount: number;
  };
  taxRate: number;
  discount: number;
  discountType: "percent" | "fixed";
  shipping: number;
  amountPaid: number;
  notes: string;
  terms: string;
  /** Optional overlay shown on preview + PDF when enabled */
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkImage: string | null;
  /** Optional custom typography for preview + PDF */
  typography: InvoiceTypography;
}

export type InvoiceFontFamily =
  | "default"
  | "sans"
  | "serif"
  | "mono"
  | "classic"
  | "rounded";

export type InvoiceHeadingLevel = "h1" | "h2" | "h3";

export interface InvoiceTypography {
  /** When false, template defaults are used */
  enabled: boolean;
  fontFamily: InvoiceFontFamily;
  /** Body base size in px (11–18) */
  baseSize: number;
  /** Invoice title treated as H1 / H2 / H3 */
  titleLevel: InvoiceHeadingLevel;
  boldTitles: boolean;
  boldBody: boolean;
  italicBody: boolean;
  italicNotes: boolean;
}

export const FONT_FAMILY_OPTIONS: { id: InvoiceFontFamily; label: string; stack: string }[] = [
  {
    id: "default",
    label: "Template default",
    stack: "",
  },
  {
    id: "sans",
    label: "Sans (Helvetica)",
    stack: 'Helvetica, Arial, "Segoe UI", sans-serif',
  },
  {
    id: "serif",
    label: "Serif (Georgia)",
    stack: 'Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif',
  },
  {
    id: "mono",
    label: "Mono (Courier)",
    stack: '"Courier New", Courier, monospace',
  },
  {
    id: "classic",
    label: "Classic (Times)",
    stack: '"Times New Roman", Times, serif',
  },
  {
    id: "rounded",
    label: "Rounded (Verdana)",
    stack: 'Verdana, Geneva, Tahoma, sans-serif',
  },
];

export const HEADING_LEVELS: {
  id: InvoiceHeadingLevel;
  label: string;
  size: number;
}[] = [
  { id: "h1", label: "H1 — Large", size: 36 },
  { id: "h2", label: "H2 — Medium", size: 28 },
  { id: "h3", label: "H3 — Compact", size: 22 },
];

export function createDefaultTypography(): InvoiceTypography {
  return {
    enabled: false,
    fontFamily: "default",
    baseSize: 13,
    titleLevel: "h2",
    boldTitles: true,
    boldBody: false,
    italicBody: false,
    italicNotes: false,
  };
}

export function normalizeTypography(
  value: Partial<InvoiceTypography> | null | undefined,
): InvoiceTypography {
  const base = createDefaultTypography();
  if (!value || typeof value !== "object") return base;
  const familyIds = FONT_FAMILY_OPTIONS.map((f) => f.id);
  const levelIds = HEADING_LEVELS.map((h) => h.id);
  return {
    enabled: Boolean(value.enabled),
    fontFamily: familyIds.includes(value.fontFamily as InvoiceFontFamily)
      ? (value.fontFamily as InvoiceFontFamily)
      : base.fontFamily,
    baseSize: Math.min(18, Math.max(11, Number(value.baseSize) || base.baseSize)),
    titleLevel: levelIds.includes(value.titleLevel as InvoiceHeadingLevel)
      ? (value.titleLevel as InvoiceHeadingLevel)
      : base.titleLevel,
    boldTitles: value.boldTitles !== false,
    boldBody: Boolean(value.boldBody),
    italicBody: Boolean(value.italicBody),
    italicNotes: Boolean(value.italicNotes),
  };
}

/** Resolved sizes/weights for InvoicePreview + PDF */
export function resolveTypographyStyles(
  typography: InvoiceTypography,
  templateSerif: boolean,
) {
  const ty = normalizeTypography(typography);
  const serifStack = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  const sansStack = 'Helvetica, Arial, "Segoe UI", sans-serif';
  const option = FONT_FAMILY_OPTIONS.find((f) => f.id === ty.fontFamily);
  const fontFamily =
    ty.enabled && option?.stack
      ? option.stack
      : templateSerif
        ? serifStack
        : sansStack;

  const scale = ty.enabled ? ty.baseSize / 13 : 1;
  const sz = (n: number) => Math.round(n * scale * 10) / 10;
  const titleSize = ty.enabled
    ? HEADING_LEVELS.find((h) => h.id === ty.titleLevel)?.size ?? 28
    : null;
  const titleWeight = !ty.enabled ? null : ty.boldTitles ? 800 : 500;
  const bodyWeight = !ty.enabled ? null : ty.boldBody ? 700 : 400;
  const bodyStyle: "normal" | "italic" = ty.enabled && ty.italicBody ? "italic" : "normal";
  const notesStyle: "normal" | "italic" = ty.enabled && ty.italicNotes ? "italic" : "normal";

  return {
    enabled: ty.enabled,
    fontFamily,
    scale,
    sz,
    titleSize,
    titleWeight,
    bodyWeight,
    bodyStyle,
    notesStyle,
    labelSize: sz(10),
    bodySize: sz(13),
    smallSize: sz(12),
    tableSize: sz(12.5),
    businessSize: sz(17),
    totalSize: sz(14),
    heroSize: sz(34),
  };
}

export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "AED", symbol: "AED ", label: "UAE Dirham" },
  { code: "PKR", symbol: "₨", label: "Pakistani Rupee" },
] as const;

export const uid = () => Math.random().toString(36).slice(2, 10);

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function emptyParty(partial: Partial<Party> = {}): Party {
  return {
    name: "",
    email: "",
    address: "",
    phone: "",
    taxId: "",
    taxIdSecondary: "",
    ...partial,
  };
}

export function createDefaultInvoice(localeSlug?: string | null): InvoiceData {
  const locale: InvoiceLocale | undefined = getLocale(localeSlug ?? undefined);
  return {
    templateSlug: "modern",
    localeSlug: locale?.slug ?? null,
    accentColor: null,
    currency: locale?.currency ?? "USD",
    logo: null,
    signature: null,
    invoiceNumber: `${new Date().getFullYear()}-0001`,
    issueDate: today(),
    dueDate: inDays(14),
    poNumber: "",
    from: emptyParty({
      name: "Your Business Ltd",
      email: "billing@example.com",
      address: locale?.sampleFromAddress ?? "12 Market Street\nYour city",
    }),
    to: emptyParty({
      name: "Client Company Inc",
      email: "accounts@example.com",
      address: locale?.sampleToAddress ?? "480 Harbour Road\nClient city",
    }),
    items: (locale?.sampleItems ?? [
      { description: "Website design — discovery & wireframes", quantity: 1, rate: 1200 },
      { description: "Frontend development (hours)", quantity: 18, rate: 85 },
    ]).map((item) => ({ id: uid(), ...item })),
    taxRate: locale?.defaultTaxRate ?? 0,
    discount: 0,
    discountType: "percent",
    shipping: 0,
    amountPaid: 0,
    notes: locale?.defaultNotes ?? "Thank you for your business. Payment via bank transfer or card.",
    terms: locale?.defaultTerms ?? "Net 14. Late payments incur 2% interest per month.",
    watermarkEnabled: false,
    watermarkText: "PAID",
    watermarkOpacity: 0.14,
    watermarkImage: null,
    typography: createDefaultTypography(),
  };
}

export interface Totals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shipping: number;
  total: number;
  balanceDue: number;
}

export function computeTotals(d: InvoiceData): Totals {
  const subtotal = d.items.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.rate) || 0),
    0,
  );
  if (d.financialBreakdown) {
    const discountAmount =
      d.financialBreakdown.lineDiscountTotal +
      d.financialBreakdown.overallDiscountAmount;
    const taxAmount =
      d.financialBreakdown.lineTaxTotal +
      d.financialBreakdown.overallTaxAmount;
    const shipping = Number(d.shipping) || 0;
    const total = subtotal + taxAmount - discountAmount + shipping;
    return {
      subtotal,
      discountAmount,
      taxAmount,
      shipping,
      total,
      balanceDue: total - (Number(d.amountPaid) || 0),
    };
  }

  const discountAmount =
    d.discountType === "percent" ? (subtotal * (Number(d.discount) || 0)) / 100 : Number(d.discount) || 0;
  const taxAmount = (subtotal * (Number(d.taxRate) || 0)) / 100;
  const shipping = Number(d.shipping) || 0;
  const total = subtotal - discountAmount + taxAmount + shipping;
  return {
    subtotal,
    discountAmount,
    taxAmount,
    shipping,
    total,
    balanceDue: total - (Number(d.amountPaid) || 0),
  };
}

export function formatMoney(amount: number, currency: string) {
  const entry = CURRENCIES.find((c) => c.code === currency);
  const value = (Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Use currency symbol if available, otherwise use currency code
  const symbol = entry?.symbol ?? currency;
  return `${symbol}${value}`;
}

/* ---------------------------------- validation --------------------------------- */

const partySchema = (who: string) =>
  z.object({
    name: z.string().trim().min(2, `${who} name must be at least 2 characters.`).max(120),
    email: z
      .string()
      .trim()
      .max(255)
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: `Enter a valid ${who.toLowerCase()} email address, or leave it blank.`,
      }),
    address: z.string().max(400).optional().default(""),
    phone: z.string().max(40).optional().default(""),
    taxId: z.string().max(60).optional().default(""),
    taxIdSecondary: z.string().max(60).optional().default(""),
  });

export const invoiceSchema = z
  .object({
    invoiceNumber: z
      .string()
      .trim()
      .min(1, "Add an invoice number — accounts teams reject invoices without one.")
      .max(40, "Invoice number must be 40 characters or fewer."),
    issueDate: z.string().min(1, "Choose an issue date."),
    dueDate: z.string().min(1, "Choose a due date."),
    from: partySchema("Your business"),
    to: partySchema("Client"),
    items: z
      .array(
        z.object({
          description: z.string().trim().max(300),
          quantity: z.number().min(0, "Quantity cannot be negative."),
          rate: z.number().min(0, "Rate cannot be negative."),
        }),
      )
      .min(1, "Add at least one line item."),
    taxRate: z.number().min(0, "Tax rate cannot be negative.").max(100, "Tax rate cannot exceed 100%."),
    discount: z.number().min(0, "Discount cannot be negative."),
    shipping: z.number().min(0, "Shipping cannot be negative."),
    amountPaid: z.number().min(0, "Amount paid cannot be negative."),
  })
  .superRefine((d, ctx) => {
    if (d.issueDate && d.dueDate && d.dueDate < d.issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "The due date cannot be before the issue date.",
      });
    }
    if (d.items.every((i) => i.description.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Describe at least one line item so your client knows what they are paying for.",
      });
    }
  });

/** Returns a map of dotted field path -> human readable message. */
export function validateInvoice(d: InvoiceData): Record<string, string> {
  const result = invoiceSchema.safeParse(d);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/* ---------------------------------- persistence -------------------------------- */

export const DRAFT_KEY = "invoicecreator:draft:v1";
const LEGACY_DRAFT_KEY = "invoiceforge:draft:v1";

export function draftStorageKey(localeSlug?: string | null) {
  return localeSlug ? `${DRAFT_KEY}:${localeSlug}` : DRAFT_KEY;
}

export function loadDraft(localeSlug?: string | null): InvoiceData | null {
  if (typeof window === "undefined") return null;
  try {
    const key = draftStorageKey(localeSlug);
    const raw = localeSlug
      ? window.localStorage.getItem(key)
      : (window.localStorage.getItem(DRAFT_KEY) ??
        window.localStorage.getItem(LEGACY_DRAFT_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InvoiceData>;
    const base = createDefaultInvoice(localeSlug);
    return {
      ...base,
      ...parsed,
      from: { ...base.from, ...(parsed.from ?? {}) },
      to: { ...base.to, ...(parsed.to ?? {}) },
      watermarkEnabled: Boolean(parsed.watermarkEnabled),
      watermarkText:
        typeof parsed.watermarkText === "string" && parsed.watermarkText.trim()
          ? parsed.watermarkText
          : base.watermarkText,
      watermarkOpacity:
        typeof parsed.watermarkOpacity === "number"
          ? Math.min(0.45, Math.max(0.04, parsed.watermarkOpacity))
          : base.watermarkOpacity,
      watermarkImage:
        typeof parsed.watermarkImage === "string" ? parsed.watermarkImage : null,
      accentColor:
        typeof parsed.accentColor === "string" &&
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(parsed.accentColor)
          ? parsed.accentColor
          : null,
      localeSlug: localeSlug ?? (typeof parsed.localeSlug === "string" ? parsed.localeSlug : null),
      typography: normalizeTypography(parsed.typography),
      items:
        Array.isArray(parsed.items) && parsed.items.length
          ? parsed.items.map((i) => ({ id: i.id ?? uid(), description: i.description ?? "", quantity: Number(i.quantity) || 0, rate: Number(i.rate) || 0 }))
          : base.items,
    };
  } catch {
    return null;
  }
}

export function saveDraft(data: InvoiceData) {
  try {
    window.localStorage.setItem(draftStorageKey(data.localeSlug), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(localeSlug?: string | null) {
  try {
    window.localStorage.removeItem(draftStorageKey(localeSlug));
    if (!localeSlug) window.localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
