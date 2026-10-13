export interface InvoiceLocale {
  slug: string;
  currency: string;
  defaultTaxRate: number;
  taxIdLabel: string;
  taxIdSecondaryLabel: string;
  taxIdPlaceholder: string;
  taxIdSecondaryPlaceholder: string;
  sampleFromAddress: string;
  sampleToAddress: string;
  sampleItems: { description: string; quantity: number; rate: number }[];
  defaultNotes: string;
  defaultTerms: string;
}

export const LOCALES: InvoiceLocale[] = [
  {
    slug: "pakistan",
    currency: "PKR",
    defaultTaxRate: 18,
    taxIdLabel: "NTN",
    taxIdSecondaryLabel: "STRN",
    taxIdPlaceholder: "e.g. 1234567-8",
    taxIdSecondaryPlaceholder: "Sales tax registration no.",
    sampleFromAddress: "Office 12, Plot 45\nShahrah-e-Faisal\nKarachi, Sindh",
    sampleToAddress: "Client office\nJail Road\nLahore, Punjab",
    sampleItems: [
      { description: "Website design — discovery & wireframes", quantity: 1, rate: 85000 },
      { description: "Frontend development (hours)", quantity: 18, rate: 4500 },
    ],
    defaultNotes: "Thank you for your business. Please pay in PKR by bank transfer.",
    defaultTerms: "Payment due in 14 days. Late payments may incur a fee as agreed in the contract.",
  },
  {
    slug: "uae",
    currency: "AED",
    defaultTaxRate: 5,
    taxIdLabel: "TRN",
    taxIdSecondaryLabel: "Trade licence",
    taxIdPlaceholder: "e.g. 100123456700003",
    taxIdSecondaryPlaceholder: "Trade licence number",
    sampleFromAddress: "Office 804, Business Bay\nDubai, UAE",
    sampleToAddress: "Client office\nAbu Dhabi, UAE",
    sampleItems: [
      { description: "Consulting services", quantity: 1, rate: 5000 },
      { description: "Implementation support (hours)", quantity: 12, rate: 450 },
    ],
    defaultNotes: "Thank you for your business. Please remit payment in AED.",
    defaultTerms: "Payment due within 14 days of the invoice date.",
  },
  {
    slug: "uk",
    currency: "GBP",
    defaultTaxRate: 20,
    taxIdLabel: "VAT number",
    taxIdSecondaryLabel: "Company number",
    taxIdPlaceholder: "e.g. GB123456789",
    taxIdSecondaryPlaceholder: "Companies House number",
    sampleFromAddress: "10 High Street\nLondon, United Kingdom",
    sampleToAddress: "Client office\nManchester, United Kingdom",
    sampleItems: [
      { description: "Design services", quantity: 1, rate: 850 },
      { description: "Development (hours)", quantity: 16, rate: 75 },
    ],
    defaultNotes: "Thank you for your business.",
    defaultTerms: "Payment due within 14 days. Please quote the invoice number when paying.",
  },
  {
    slug: "usa",
    currency: "USD",
    defaultTaxRate: 0,
    taxIdLabel: "EIN / Tax ID",
    taxIdSecondaryLabel: "State tax ID",
    taxIdPlaceholder: "e.g. 12-3456789",
    taxIdSecondaryPlaceholder: "State registration number",
    sampleFromAddress: "100 Market Street\nSan Francisco, CA",
    sampleToAddress: "Client office\nNew York, NY",
    sampleItems: [
      { description: "Professional services", quantity: 1, rate: 1200 },
      { description: "Implementation (hours)", quantity: 10, rate: 95 },
    ],
    defaultNotes: "Thank you for your business.",
    defaultTerms: "Payment due within 14 days. Please include the invoice number with your payment.",
  },
];

export function getLocale(slug: string | null | undefined): InvoiceLocale | undefined {
  return LOCALES.find((locale) => locale.slug === slug);
}
