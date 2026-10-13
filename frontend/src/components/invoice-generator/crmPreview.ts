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

export function buildCrmDocumentPreview({
  appearance,
  documentType,
  documentNumber,
  customerName,
  issueDate,
  dueDate,
  lines,
  currency = "USD",
  businessName,
  businessAddress,
  businessEmail,
  overallDiscountPercent = 0,
  overallTaxPercent = 0,
  notes = "",
}: {
  appearance?: Partial<DocumentAppearance> | null;
  documentType: "Invoice" | "Quote";
  documentNumber?: string;
  customerName?: string;
  issueDate?: string;
  dueDate?: string | null;
  lines: CrmPreviewLine[];
  currency?: string;
  businessName?: string;
  businessAddress?: string;
  businessEmail?: string;
  overallDiscountPercent?: number;
  overallTaxPercent?: number;
  notes?: string;
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
  const totalDiscount = lineDiscounts + overallDiscount;
  const taxable = subtotal - totalDiscount;
  const overallTax = taxable * (overallTaxPercent / 100);

  return {
    ...data,
    templateSlug: appearance?.template_slug || "modern",
    accentColor: appearance?.accent_color || null,
    typography: appearance?.typography || createDefaultTypography(),
    currency,
    invoiceNumber: documentNumber || "Draft",
    issueDate: issueDate || data.issueDate,
    dueDate: dueDate || data.dueDate,
    from: {
      ...data.from,
      name: businessName || "Your company",
      address: businessAddress || "",
      email: businessEmail || "",
    },
    to: { ...data.to, name: customerName || "Customer" },
    items: lineItems,
    discount: totalDiscount,
    discountType: "fixed",
    taxRate: taxable > 0 ? ((lineTaxes + overallTax) / taxable) * 100 : 0,
    notes,
    terms: "",
    watermarkEnabled: false,
    watermarkText: documentType.toUpperCase(),
  };
}
