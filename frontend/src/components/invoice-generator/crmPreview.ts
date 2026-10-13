import {
  createDefaultInvoice,
  createDefaultTypography,
  type InvoiceData,
} from "./invoice";
import type { DocumentAppearance } from "./InvoiceAppearanceEditor";

export interface CrmPreviewLine {
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_rate?: number;
  variant_name?: string;
  manual_variant_name?: string;
  description?: string;
}

function resolveLogoUrl(logo?: string | null): string | null {
  const source = logo?.trim();
  if (!source) return null;
  if (/^(https?:)?\/\//i.test(source) || /^(data|blob):/i.test(source)) {
    return source;
  }

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  return `${apiBase}/${source.replace(/^\/+/, "")}`;
}

export function buildCrmDocumentPreview({
  appearance,
  documentType,
  documentNumber,
  customerName,
  customerEmail,
  customerPhone,
  customerAddress,
  issueDate,
  dueDate,
  lines,
  currency = "USD",
  businessName,
  businessAddress,
  businessEmail,
  businessLogo,
  overallDiscountPercent = 0,
  overallTaxPercent = 0,
  notes = "",
  terms = "",
}: {
  appearance?: Partial<DocumentAppearance> | null;
  documentType: "Invoice" | "Quote";
  documentNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  issueDate?: string;
  dueDate?: string | null;
  lines: CrmPreviewLine[];
  currency?: string;
  businessName?: string;
  businessAddress?: string;
  businessEmail?: string;
  businessLogo?: string | null;
  overallDiscountPercent?: number;
  overallTaxPercent?: number;
  notes?: string;
  terms?: string;
}): InvoiceData {
  const data = createDefaultInvoice();
  const lineItems = lines.map((line, index) => ({
    id: `crm-line-${index}`,
    description: [
      line.manual_variant_name?.trim() || line.variant_name?.trim() || `Item ${index + 1}`,
      line.description?.trim(),
    ]
      .filter(Boolean)
      .join(" — "),
    quantity: Number(line.quantity) || 0,
    rate: Number(line.unit_price) || 0,
    discountAmount: Number(line.discount_amount) || 0,
    taxRate: Number(line.tax_rate) || 0,
  }));
  const subtotal = lines.reduce(
    (total, line) => total + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
    0,
  );
  const lineDiscounts = lines.reduce(
    (total, line) => total + (Number(line.discount_amount) || 0),
    0,
  );
  const lineTaxes = lines.reduce((total, line) => {
    const net = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0) -
      (Number(line.discount_amount) || 0);
    return total + net * ((Number(line.tax_rate) || 0) / 100);
  }, 0);
  const overallDiscount = subtotal * (overallDiscountPercent / 100);
  const taxable = subtotal - lineDiscounts - overallDiscount;
  const overallTax = taxable * (overallTaxPercent / 100);
  return {
    ...data,
    templateSlug: appearance?.template_slug || "modern",
    accentColor: appearance?.accent_color || null,
    typography: appearance?.typography || createDefaultTypography(),
    currency,
    logo: resolveLogoUrl(businessLogo),
    invoiceNumber: documentNumber || "Draft",
    issueDate: issueDate || data.issueDate,
    dueDate: dueDate || data.dueDate,
    from: {
      ...data.from,
      name: businessName || "Your company",
      address: businessAddress || "",
      email: businessEmail || "",
    },
    to: {
      ...data.to,
      name: customerName || "Customer",
      email: customerEmail || "",
      phone: customerPhone || "",
      address: customerAddress || "",
    },
    items: lineItems,
    financialBreakdown: {
      lineDiscountTotal: lineDiscounts,
      lineTaxTotal: lineTaxes,
      overallDiscountPercent,
      overallDiscountAmount: overallDiscount,
      overallTaxPercent,
      overallTaxAmount: overallTax,
    },
    discount: lineDiscounts + overallDiscount,
    discountType: "fixed",
    taxRate: taxable > 0 ? ((lineTaxes + overallTax) / taxable) * 100 : 0,
    notes,
    terms,
    watermarkEnabled: false,
    watermarkText: documentType.toUpperCase(),
  };
}
