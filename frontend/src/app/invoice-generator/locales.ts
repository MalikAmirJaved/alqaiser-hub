export interface LocaleFaq {
  q: string;
  a: string;
}

export interface LocaleGuideSection {
  heading: string;
  paragraphs: string[];
}

export interface LocaleFieldHighlight {
  label: string;
  body: string;
}

export interface InvoiceLocale {
  slug: string;
  country: string;
  adjective: string;
  currency: string;
  path: string;
  /** Pre-filled rate the user can change. Not legal advice. */
  defaultTaxRate: number;
  taxRateLabel: string;
  taxIdLabel: string;
  taxIdSecondaryLabel: string;
  taxIdPlaceholder: string;
  taxIdSecondaryPlaceholder: string;
  sampleFromAddress: string;
  sampleToAddress: string;
  sampleItems: { description: string; quantity: number; rate: number }[];
  defaultNotes: string;
  defaultTerms: string;
  /** SEO + page copy for /invoice-generator/[slug] */
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  heroLead: string;
  heroBullets: string[];
  authorityNote: string;
  guideSections: LocaleGuideSection[];
  fieldHighlights: LocaleFieldHighlight[];
  faqs: LocaleFaq[];
  generatorHeading: string;
  generatorLead: string;
  lastReviewed: string;
}

export const LOCALES: InvoiceLocale[] = [
  {
    slug: "pakistan",
    country: "Pakistan",
    adjective: "Pakistani",
    currency: "PKR",
    path: "/invoice-generator/pakistan",
    defaultTaxRate: 18,
    taxRateLabel: "Sales tax / GST (%)",
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
    defaultNotes:
      "Thank you for your business. Please pay in PKR by bank transfer. NTN and STRN are shown above.",
    defaultTerms:
      "Payment due in 14 days. Late payments may incur a fee as agreed in the contract. This invoice is not tax advice — confirm GST/PST with your accountant or FBR.",
    seoTitle: "Invoice Generator Pakistan — Free PKR Invoice with NTN & STRN",
    seoDescription:
      "Free invoice generator for Pakistan. Create a PKR invoice with NTN and STRN fields, add GST, and download a print-ready PDF. No signup, no watermark.",
    keywords: [
      "invoice generator Pakistan",
      "invoice generator PKR",
      "NTN invoice generator",
      "STRN invoice format",
      "free invoice generator Pakistan",
    ],
    heroLead:
      "Build a PKR invoice with NTN and STRN on the PDF — not a US dollar template with “Pakistan” written at the top. Download instantly. No account, no watermark.",
    heroBullets: [
      "Currency locked to PKR by default",
      "NTN + STRN fields print on the PDF",
      "GST rate you control (default 18%)",
    ],
    authorityNote:
      "Verify current requirements with FBR, the relevant provincial authority, or a qualified professional.",
    guideSections: [
      {
        heading: "What a Pakistan invoice actually needs",
        paragraphs: [
          "Pakistani clients and accounts teams look for the same commercial fields as anywhere else — who billed whom, what was supplied, the invoice number, dates, and a total in a currency they can pay. They also look for tax identifiers that a generic “invoice generator” often hides behind a single “Tax ID” label.",
          "This page pre-fills Pakistani Rupee (PKR), labels the seller and buyer tax fields as NTN (National Tax Number) and STRN (Sales Tax Registration Number), and starts the tax rate at 18% so you can edit it instead of hunting for a percentage box.",
        ],
      },
      {
        heading: "NTN vs STRN — which number goes where",
        paragraphs: [
          "NTN identifies you (or your company) as a taxpayer with the Federal Board of Revenue. Put your NTN on the “from” side. If you know the client’s NTN, add it on the “bill to” side — useful for B2B work and for the buyer’s own records.",
          "STRN is separate: it is the sales-tax registration, used when the supply is within the sales-tax net. If you are not sales-tax registered, leave STRN empty. Do not copy someone else’s number or type a placeholder onto a live invoice.",
        ],
      },
      {
        heading: "GST, provincial sales tax, and this generator",
        paragraphs: [
          "Federal GST on many goods has commonly been charged at 18%, which is why the tax field defaults there. That is a starting point, not a ruling. Services billed from Sindh, Punjab and other provinces may instead attract provincial sales tax at a different rate, with a different registration. Zero-rated and exempt supplies should show 0% tax and, if your accountant requires it, a short note in the terms box explaining why tax is not charged.",
          "Invoice Creator does not file returns, generate FBR e-invoices, or tell you which rate applies to your contract. Change the rate on every invoice until it matches the advice you already follow.",
        ],
      },
      {
        heading: "PKR, numbering, and getting paid",
        paragraphs: [
          "Keep the invoice in PKR when the contract is in rupees. If you agreed USD or another currency, switch the currency dropdown — do not write “USD” in the description while the total still shows ₨. Use a unique invoice number (year + sequence is enough for most freelancers). Put your bank title, account number and IBAN in the notes so the client does not have to email you for payment details.",
        ],
      },
    ],
    fieldHighlights: [
      { label: "PKR", body: "totals and the PDF use rupees unless you change currency." },
      { label: "NTN", body: "prints on both seller and client blocks when filled." },
      { label: "STRN", body: "second tax line, not jammed into a generic VAT field." },
      { label: "Sales tax %", body: "editable; 18% is only the default." },
    ],
    faqs: [
      {
        q: "Can I create a PKR invoice without signing up?",
        a: "Yes. This page opens a Pakistan-ready generator in your browser. Set PKR, fill NTN and STRN, add line items and download a PDF. Nothing is uploaded to our servers.",
      },
      {
        q: "What is an NTN on a Pakistani invoice?",
        a: "NTN is your National Tax Number issued through FBR. Registered suppliers normally print it on invoices so the buyer can verify who issued the bill. Enter it in the NTN field; it prints on the PDF next to your business details.",
      },
      {
        q: "What is an STRN?",
        a: "STRN is the Sales Tax Registration Number. If you are registered for sales tax, show it on invoices where the supply is taxable. Unregistered suppliers should leave STRN blank rather than inventing a number.",
      },
      {
        q: "Does this file invoices with FBR or IRIS?",
        a: "No. This tool produces a professional PDF for you to send to the client. It does not submit e-invoices to FBR, PRAL or IRIS. Digital invoicing rules change — confirm current filing requirements with your tax advisor.",
      },
      {
        q: "Should I charge 18% GST on every invoice?",
        a: "No. The generator defaults to 18% as a common federal GST rate on many goods, but services can fall under provincial sales tax (Sindh SRB, Punjab PRA, KP, Balochistan) at different rates — or be exempt. Change the rate to match your supply, or set it to 0 if tax is not applicable.",
      },
    ],
    generatorHeading: "Create your Pakistan invoice",
    generatorLead:
      "PKR, NTN and STRN are ready. Edit the GST rate to match this supply, then download the PDF. Drafts for this page stay in this browser only.",
    lastReviewed: "September 2026",
  },
  {
    slug: "uae",
    country: "UAE",
    adjective: "UAE",
    currency: "AED",
    path: "/invoice-generator/uae",
    defaultTaxRate: 5,
    taxRateLabel: "VAT (%)",
    taxIdLabel: "TRN",
    taxIdSecondaryLabel: "Trade licence",
    taxIdPlaceholder: "e.g. 100123456700003",
    taxIdSecondaryPlaceholder: "Trade licence number (optional)",
    sampleFromAddress: "Office 204, Business Bay\nDubai, United Arab Emirates",
    sampleToAddress: "Client company\nAl Maryah Island\nAbu Dhabi, UAE",
    sampleItems: [
      { description: "Consulting — discovery workshop", quantity: 1, rate: 4500 },
      { description: "Implementation (hours)", quantity: 12, rate: 350 },
    ],
    defaultNotes:
      "Thank you for your business. Please pay in AED by bank transfer. TRN is shown above where provided.",
    defaultTerms:
      "Payment due in 14 days. Confirm applicable VAT treatment with your accountant or FTA. This invoice is not tax advice.",
    seoTitle: "Invoice Generator UAE — Free AED Invoice with TRN & VAT",
    seoDescription:
      "Free invoice generator for the UAE. Create an AED invoice with TRN fields, add VAT, and download a print-ready PDF. No signup, no watermark.",
    keywords: [
      "invoice generator UAE",
      "invoice generator AED",
      "TRN invoice UAE",
      "VAT invoice generator Dubai",
      "free invoice generator UAE",
    ],
    heroLead:
      "Create an AED invoice with TRN on the PDF and a VAT field you control — built for freelancers and businesses billing in the United Arab Emirates.",
    heroBullets: [
      "Currency set to AED by default",
      "TRN fields for seller and client",
      "VAT rate you control (default 5%)",
    ],
    authorityNote:
      "Verify current requirements with the Federal Tax Authority (FTA) or a qualified professional in the UAE.",
    guideSections: [
      {
        heading: "What a UAE invoice typically needs",
        paragraphs: [
          "UAE clients expect clear commercial details: who billed whom, what was supplied, invoice number, dates, and a total in AED when the contract is in dirhams. VAT-registered suppliers also need space for a Tax Registration Number (TRN).",
          "This page pre-fills AED, labels tax ID fields as TRN, and starts VAT at 5% so you can adjust it to match the supply — including setting 0% for zero-rated or out-of-scope work when that applies.",
        ],
      },
      {
        heading: "TRN on seller and buyer sides",
        paragraphs: [
          "If you are VAT-registered, put your TRN on the “from” side. For B2B supplies, including the customer’s TRN (when known) helps their accounts team process the invoice.",
          "If you are not VAT-registered, leave TRN blank rather than inventing a number. Do not copy another business’s TRN onto a live invoice.",
        ],
      },
      {
        heading: "VAT and this generator",
        paragraphs: [
          "The standard UAE VAT rate on many taxable supplies has commonly been 5%, which is why the tax field defaults there. That is a starting point, not a ruling. Some supplies may be zero-rated, exempt, or outside the scope of VAT.",
          "Invoice Creator does not file VAT returns, generate EmaraTax submissions, or decide which rate applies. Change the rate on every invoice to match the advice you already follow.",
        ],
      },
      {
        heading: "AED, numbering, and getting paid",
        paragraphs: [
          "Keep the invoice in AED when the contract is in dirhams. If you agreed USD or another currency, switch the currency dropdown so the total matches the payment method. Use a unique invoice number and put bank details (including IBAN where used) in the notes.",
        ],
      },
    ],
    fieldHighlights: [
      { label: "AED", body: "totals and the PDF use dirhams unless you change currency." },
      { label: "TRN", body: "prints on seller and client blocks when filled." },
      { label: "Trade licence", body: "optional second identifier line on the PDF." },
      { label: "VAT %", body: "editable; 5% is only the default." },
    ],
    faqs: [
      {
        q: "Can I create an AED invoice without signing up?",
        a: "Yes. This page opens a UAE-ready generator in your browser. Set AED, fill TRN if applicable, add line items and download a PDF. Nothing is uploaded to our servers.",
      },
      {
        q: "What is a TRN on a UAE invoice?",
        a: "TRN is the Tax Registration Number issued for VAT. VAT-registered suppliers normally show it on tax invoices. Enter it in the TRN field; it prints on the PDF next to your business details.",
      },
      {
        q: "Should I charge 5% VAT on every invoice?",
        a: "No. The generator defaults to 5% as a common standard rate for many taxable supplies, but some supplies may be zero-rated, exempt, or out of scope. Change the rate to match your supply, or set it to 0 when VAT does not apply.",
      },
      {
        q: "Does this file VAT returns with the FTA?",
        a: "No. This tool produces a professional PDF for you to send to the client. It does not submit returns or e-invoices to EmaraTax or the FTA.",
      },
      {
        q: "Can I invoice a client outside the UAE?",
        a: "Yes. Adjust the currency and VAT treatment to match your contract and advice from your accountant. Cross-border rules can differ — do not assume UAE domestic VAT always applies.",
      },
    ],
    generatorHeading: "Create your UAE invoice",
    generatorLead:
      "AED and TRN fields are ready. Edit the VAT rate to match this supply, then download the PDF. Drafts for this page stay in this browser only.",
    lastReviewed: "September 2026",
  },
  {
    slug: "uk",
    country: "UK",
    adjective: "UK",
    currency: "GBP",
    path: "/invoice-generator/uk",
    defaultTaxRate: 20,
    taxRateLabel: "VAT (%)",
    taxIdLabel: "VAT number",
    taxIdSecondaryLabel: "Company number",
    taxIdPlaceholder: "e.g. GB123456789",
    taxIdSecondaryPlaceholder: "Companies House number (optional)",
    sampleFromAddress: "14 King Street\nManchester\nM2 6AG\nUnited Kingdom",
    sampleToAddress: "Client Ltd\n88 Commercial Road\nLondon\nE1 1AJ",
    sampleItems: [
      { description: "Website design — discovery & wireframes", quantity: 1, rate: 1200 },
      { description: "Frontend development (hours)", quantity: 18, rate: 85 },
    ],
    defaultNotes:
      "Thank you for your business. Please pay in GBP by bank transfer. VAT number is shown above where provided.",
    defaultTerms:
      "Payment due in 14 days. Confirm VAT treatment with your accountant or HMRC. This invoice is not tax advice.",
    seoTitle: "Invoice Generator UK — Free GBP Invoice with VAT Number",
    seoDescription:
      "Free invoice generator for the UK. Create a GBP invoice with VAT number fields, add VAT, and download a print-ready PDF. No signup, no watermark.",
    keywords: [
      "invoice generator UK",
      "invoice generator GBP",
      "VAT invoice generator",
      "free invoice generator UK",
      "UK VAT invoice template",
    ],
    heroLead:
      "Create a GBP invoice with VAT number fields and a VAT rate you control — built for freelancers and limited companies billing in the United Kingdom.",
    heroBullets: [
      "Currency set to GBP by default",
      "VAT number + optional company number",
      "VAT rate you control (default 20%)",
    ],
    authorityNote:
      "Verify current requirements with HMRC or a qualified professional in the United Kingdom.",
    guideSections: [
      {
        heading: "What a UK invoice typically needs",
        paragraphs: [
          "UK clients and accounts teams expect clear commercial details: who billed whom, what was supplied, a unique invoice number, dates, and a total in GBP when the contract is in pounds. VAT-registered suppliers also need space for a VAT number and a clear VAT breakdown.",
          "This page pre-fills GBP, labels tax ID fields as VAT number (and optional company number), and starts VAT at 20% so you can adjust it — including reduced, zero-rated, or exempt treatment when that applies.",
        ],
      },
      {
        heading: "VAT number and company number",
        paragraphs: [
          "If you are VAT-registered, put your VAT number on the “from” side. For B2B work, including the customer’s VAT number (when known) helps their accounts payable team.",
          "Company number (Companies House) is optional on many invoices but useful for limited companies. Leave fields blank if they do not apply — do not invent registration numbers.",
        ],
      },
      {
        heading: "VAT and this generator",
        paragraphs: [
          "The standard UK VAT rate on many taxable supplies has commonly been 20%, which is why the tax field defaults there. That is a starting point, not a ruling. Reduced rates, zero-rating, exemption, and reverse charge can apply depending on the supply.",
          "Invoice Creator does not file VAT returns, submit Making Tax Digital data, or decide which rate applies. Change the rate on every invoice to match the advice you already follow.",
        ],
      },
      {
        heading: "GBP, numbering, and getting paid",
        paragraphs: [
          "Keep the invoice in GBP when the contract is in pounds. If you agreed another currency, switch the currency dropdown so totals match payment. Use a unique invoice number and put sort code, account number, and any payment reference in the notes.",
        ],
      },
    ],
    fieldHighlights: [
      { label: "GBP", body: "totals and the PDF use pounds unless you change currency." },
      { label: "VAT number", body: "prints on seller and client blocks when filled." },
      { label: "Company number", body: "optional second identifier line on the PDF." },
      { label: "VAT %", body: "editable; 20% is only the default." },
    ],
    faqs: [
      {
        q: "Can I create a GBP invoice without signing up?",
        a: "Yes. This page opens a UK-ready generator in your browser. Set GBP, fill your VAT number if registered, add line items and download a PDF. Nothing is uploaded to our servers.",
      },
      {
        q: "Do I need a VAT number on every invoice?",
        a: "If you are VAT-registered and issuing a VAT invoice, you normally show your VAT number. If you are not VAT-registered, leave the field blank and do not charge VAT unless your accountant tells you otherwise.",
      },
      {
        q: "Should I charge 20% VAT on every invoice?",
        a: "No. The generator defaults to 20% as a common standard rate, but reduced, zero-rated, exempt, and reverse-charge treatments exist. Change the rate to match your supply, or set it to 0 when VAT does not apply.",
      },
      {
        q: "Does this submit anything to HMRC?",
        a: "No. This tool produces a professional PDF for you to send to the client. It does not file VAT returns or Making Tax Digital submissions.",
      },
      {
        q: "Can sole traders use this generator?",
        a: "Yes. Freelancers, sole traders, and limited companies can use it. Fill in the legal name and any registration details your clients expect.",
      },
    ],
    generatorHeading: "Create your UK invoice",
    generatorLead:
      "GBP and VAT number fields are ready. Edit the VAT rate to match this supply, then download the PDF. Drafts for this page stay in this browser only.",
    lastReviewed: "September 2026",
  },
  {
    slug: "usa",
    country: "USA",
    adjective: "US",
    currency: "USD",
    path: "/invoice-generator/usa",
    defaultTaxRate: 0,
    taxRateLabel: "Sales tax (%)",
    taxIdLabel: "EIN / Tax ID",
    taxIdSecondaryLabel: "State tax ID",
    taxIdPlaceholder: "e.g. 12-3456789",
    taxIdSecondaryPlaceholder: "State sales tax ID (optional)",
    sampleFromAddress: "1200 Market Street\nSuite 400\nAustin, TX 78701\nUnited States",
    sampleToAddress: "Client Company Inc\n500 Mission Street\nSan Francisco, CA 94105",
    sampleItems: [
      { description: "Website design — discovery & wireframes", quantity: 1, rate: 1800 },
      { description: "Frontend development (hours)", quantity: 20, rate: 120 },
    ],
    defaultNotes:
      "Thank you for your business. Please pay in USD by ACH or bank transfer. Tax IDs are shown above where provided.",
    defaultTerms:
      "Payment due in 14 days. Sales tax rules vary by state. Confirm with your accountant or state tax authority. This invoice is not tax advice.",
    seoTitle: "Invoice Generator USA — Free USD Invoice with EIN & Sales Tax",
    seoDescription:
      "Free invoice generator for the USA. Create a USD invoice with EIN / Tax ID fields, add sales tax when needed, and download a print-ready PDF. No signup, no watermark.",
    keywords: [
      "invoice generator USA",
      "invoice generator USD",
      "EIN invoice template",
      "sales tax invoice generator",
      "free invoice generator US",
    ],
    heroLead:
      "Create a USD invoice with EIN / Tax ID fields and a sales-tax rate you control — built for freelancers and small businesses billing in the United States.",
    heroBullets: [
      "Currency set to USD by default",
      "EIN / Tax ID + optional state tax ID",
      "Sales tax rate you control (default 0%)",
    ],
    authorityNote:
      "Verify current requirements with your state tax authority, the IRS (for federal identifiers), or a qualified professional.",
    guideSections: [
      {
        heading: "What a US invoice typically needs",
        paragraphs: [
          "US clients and accounts payable teams expect clear commercial details: who billed whom, what was supplied, a unique invoice number, dates, and a total in USD when the contract is in dollars. Many businesses also show an EIN or other tax ID so the buyer can record the vendor correctly.",
          "This page pre-fills USD, labels tax ID fields as EIN / Tax ID and optional state tax ID, and starts sales tax at 0% because rates and nexus rules vary widely by state — you set the rate that applies to this supply.",
        ],
      },
      {
        heading: "EIN, Tax ID, and state identifiers",
        paragraphs: [
          "Sole proprietors may use an SSN or EIN depending on how they operate; companies typically use an EIN. Put your identifier on the “from” side when clients expect it. Do not invent numbers.",
          "State tax IDs or seller’s permit numbers are separate from the EIN and matter when you collect sales tax. Leave them blank if they do not apply.",
        ],
      },
      {
        heading: "Sales tax and this generator",
        paragraphs: [
          "There is no single nationwide US sales-tax rate. Whether you charge tax depends on the type of goods or services, where you and the customer are located, and state (and sometimes local) rules. The default of 0% is intentional so you do not accidentally charge a rate that does not apply.",
          "Invoice Creator does not file sales-tax returns, register you for nexus, or decide which rate applies. Change the rate on every invoice to match the advice you already follow.",
        ],
      },
      {
        heading: "USD, numbering, and getting paid",
        paragraphs: [
          "Keep the invoice in USD when the contract is in dollars. Use a unique invoice number and put ACH, wire, or check instructions in the notes so accounts payable does not have to chase payment details.",
        ],
      },
    ],
    fieldHighlights: [
      { label: "USD", body: "totals and the PDF use dollars unless you change currency." },
      { label: "EIN / Tax ID", body: "prints on seller and client blocks when filled." },
      { label: "State tax ID", body: "optional second identifier line on the PDF." },
      { label: "Sales tax %", body: "editable; defaults to 0% because rates vary by state." },
    ],
    faqs: [
      {
        q: "Can I create a USD invoice without signing up?",
        a: "Yes. This page opens a USA-ready generator in your browser. Set USD, fill EIN / Tax ID if needed, add line items and download a PDF. Nothing is uploaded to our servers.",
      },
      {
        q: "Why is sales tax defaulted to 0%?",
        a: "Because US sales tax depends on state and local rules, product type, and nexus. Starting at 0% avoids inventing a rate. Enter the rate that applies to this invoice, or leave it at 0 if tax is not charged.",
      },
      {
        q: "Do I need an EIN on every invoice?",
        a: "Many B2B clients ask for a W-9 and an EIN for vendor setup. Showing an EIN on the invoice is optional but often helpful. Use the identifier your accountant recommends for how you are structured.",
      },
      {
        q: "Does this file sales tax returns?",
        a: "No. This tool produces a professional PDF for you to send to the client. It does not file state or federal tax returns.",
      },
      {
        q: "Can freelancers and LLCs use this?",
        a: "Yes. Freelancers, sole proprietors, LLCs, and corporations can use the generator. Fill in the legal name and any tax IDs your clients expect.",
      },
    ],
    generatorHeading: "Create your USA invoice",
    generatorLead:
      "USD and EIN / Tax ID fields are ready. Set the sales tax rate for this supply (default 0%), then download the PDF. Drafts for this page stay in this browser only.",
    lastReviewed: "September 2026",
  },
];

export function getLocale(slug: string | null | undefined): InvoiceLocale | undefined {
  if (!slug) return undefined;
  return LOCALES.find((l) => l.slug === slug);
}

export function getLocaleSlugs(): string[] {
  return LOCALES.map((l) => l.slug);
}

/** Ensures each locale path stays aligned with its slug (used by sitemap & routes). */
export function assertLocalePaths(): void {
  for (const l of LOCALES) {
    const expected = `/invoice-generator/${l.slug}`;
    if (l.path !== expected) {
      throw new Error(`Locale "${l.slug}" path is "${l.path}", expected "${expected}"`);
    }
  }
}
