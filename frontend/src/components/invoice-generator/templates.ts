export interface InvoiceTemplate {
  slug: string;
  name: string;
  /** Primary industry this template is designed for */
  industry: string;
  tagline: string;
  description: string;
  bestFor: string[];
  accent: string;
  surface: string;
  headerStyle: "bar" | "split" | "stacked" | "sidebar" | "minimal" | "band" | "corner";
  dark?: boolean;
  serif?: boolean;
}

/** Style name + industry, e.g. "Modern · Freelance" */
export function templateLabel(t: Pick<InvoiceTemplate, "name" | "industry">) {
  return `${t.name} · ${t.industry}`;
}

export const TEMPLATES: InvoiceTemplate[] = [
  {
    slug: "modern",
    name: "Modern",
    industry: "Freelance",
    tagline: "Clean lines, confident type, zero clutter.",
    description:
      "The Modern invoice template is the all-rounder for freelancers and consultants: a bold coloured header bar, generous whitespace and a crisp item table. It reads well on screen and prints beautifully in black and white.",
    bestFor: ["Freelancers", "Consultants", "SaaS companies"],
    accent: "#2563eb",
    surface: "#ffffff",
    headerStyle: "bar",
  },
  {
    slug: "minimal",
    name: "Minimal",
    industry: "Design",
    tagline: "Just the numbers, beautifully arranged.",
    description:
      "Minimal is the design-industry favourite: typography and rules only — no colour blocks, no boxes. Ideal for designers, writers and photographers who want stationery-grade invoices.",
    bestFor: ["Designers", "Writers", "Photographers"],
    accent: "#111827",
    surface: "#ffffff",
    headerStyle: "minimal",
  },
  {
    slug: "corporate",
    name: "Corporate",
    industry: "Enterprise",
    tagline: "Structured, formal and audit-friendly.",
    description:
      "Corporate is built for enterprise and B2B suppliers: two-column billing, clearly labelled reference fields and a bordered totals panel that accounts-payable teams recognise instantly.",
    bestFor: ["Agencies billing enterprises", "Suppliers", "Contractors"],
    accent: "#1e3a5f",
    surface: "#ffffff",
    headerStyle: "split",
  },
  {
    slug: "elegant",
    name: "Elegant",
    industry: "Luxury",
    tagline: "Serif headings and refined spacing.",
    description:
      "Elegant is the luxury and boutique template: serif display type, airy spacing and hairline rules. Suits premium services where the invoice is part of the client experience.",
    bestFor: ["Interior designers", "Event planners", "Boutique studios"],
    accent: "#7c5c2e",
    surface: "#fffdf8",
    headerStyle: "stacked",
    serif: true,
  },
  {
    slug: "blue",
    name: "Blue",
    industry: "Small Business",
    tagline: "Classic blue business invoice.",
    description:
      "Blue is the small-business and retail staple: a strong blue header and alternating table rows that clients recognise immediately, reducing friction with new customers.",
    bestFor: ["Small businesses", "Trades", "Retail"],
    accent: "#0369a1",
    surface: "#ffffff",
    headerStyle: "bar",
  },
  {
    slug: "dark",
    name: "Dark",
    industry: "Tech",
    tagline: "High-contrast header with a modern edge.",
    description:
      "Dark is made for tech studios and product teams: a deep charcoal header with light type, then a clean body that still prints well on paper.",
    bestFor: ["Tech studios", "Product teams", "Creative shops"],
    accent: "#0f172a",
    surface: "#ffffff",
    headerStyle: "bar",
    dark: true,
  },
  {
    slug: "startup",
    name: "Startup",
    industry: "SaaS",
    tagline: "Friendly, rounded and brand-forward.",
    description:
      "Startup is the SaaS and indie-maker template: logo-forward with a soft gradient band so the invoice feels like the rest of your product, not a legal form.",
    bestFor: ["Early-stage startups", "Indie makers", "Subscription tools"],
    accent: "#0d9488",
    surface: "#ffffff",
    headerStyle: "stacked",
  },
  {
    slug: "agency",
    name: "Agency",
    industry: "Marketing",
    tagline: "Project-based billing with a side rail.",
    description:
      "Agency is built for marketing and creative agencies: metadata sits in a side rail so multi-line project and retainer invoices get full table width.",
    bestFor: ["Marketing agencies", "Dev shops", "Consultancies"],
    accent: "#4338ca",
    surface: "#ffffff",
    headerStyle: "sidebar",
  },
  {
    slug: "creative",
    name: "Creative",
    industry: "Creative Arts",
    tagline: "Colour blocks and expressive numbers.",
    description:
      "Creative is for illustrators, videographers and brand designers: colour-blocked header and an expressive amount-due so the invoice stands out in a crowded inbox.",
    bestFor: ["Illustrators", "Videographers", "Brand designers"],
    accent: "#db2777",
    surface: "#ffffff",
    headerStyle: "split",
  },
  {
    slug: "classic",
    name: "Classic",
    industry: "Accounting",
    tagline: "The traditional ruled invoice.",
    description:
      "Classic is the accounting and wholesale standard: full-width rules, centred title and a compact totals ladder — safest for clients who still file paper.",
    bestFor: ["Accountants", "Wholesalers", "Long-standing businesses"],
    accent: "#374151",
    surface: "#ffffff",
    headerStyle: "minimal",
    serif: true,
  },
  {
    slug: "nordic",
    name: "Nordic",
    industry: "Architecture",
    tagline: "Calm, airy and Scandinavian-clean.",
    description:
      "Nordic is the architecture and product-design template: a thin colour band, quiet whitespace and soft hierarchy for studios that sell craft and calm.",
    bestFor: ["Architects", "Product designers", "Wellness brands"],
    accent: "#64748b",
    surface: "#f8fafc",
    headerStyle: "band",
  },
  {
    slug: "emerald",
    name: "Emerald",
    industry: "Healthcare",
    tagline: "Fresh green for care and consulting.",
    description:
      "Emerald is for clinics, coaches and wellness brands: a confident green header and clear item table that feels trustworthy and modern.",
    bestFor: ["Clinics", "Coaches", "Eco brands"],
    accent: "#059669",
    surface: "#ffffff",
    headerStyle: "bar",
  },
  {
    slug: "sunset",
    name: "Sunset",
    industry: "Hospitality",
    tagline: "Warm gradient energy for hospitality.",
    description:
      "Sunset is the hospitality template for restaurants, hotels and event hosts: warm stacked header and inviting accents so invoices feel welcoming.",
    bestFor: ["Restaurants", "Hotels", "Event hosts"],
    accent: "#ea580c",
    surface: "#fffaf5",
    headerStyle: "stacked",
  },
  {
    slug: "slate",
    name: "Slate",
    industry: "Legal",
    tagline: "Quiet professionalism for serious work.",
    description:
      "Slate is built for law firms and professional services: a split header, clear reference block and restrained colour that looks formal and easy to scan.",
    bestFor: ["Law firms", "Accountants", "Advisors"],
    accent: "#475569",
    surface: "#ffffff",
    headerStyle: "split",
  },
  {
    slug: "bold",
    name: "Bold",
    industry: "Sales",
    tagline: "Loud corner accent, hard to ignore.",
    description:
      "Bold is for sales teams and course creators: a large colour corner behind the title so the PDF stands out in a busy client inbox.",
    bestFor: ["Sales teams", "Agencies", "Course creators"],
    accent: "#dc2626",
    surface: "#ffffff",
    headerStyle: "corner",
  },
  {
    slug: "lavender",
    name: "Lavender",
    industry: "Beauty",
    tagline: "Soft purple for creative services.",
    description:
      "Lavender is the beauty, coaching and education template: lilac wash and gentle accents so retainers feel personal rather than corporate.",
    bestFor: ["Coaches", "Beauty studios", "Educators"],
    accent: "#7c3aed",
    surface: "#faf5ff",
    headerStyle: "stacked",
  },
  {
    slug: "ocean",
    name: "Ocean",
    industry: "Consulting",
    tagline: "Deep teal side rail for project work.",
    description:
      "Ocean is for consultants and freelancers billing multi-phase projects: teal side rail keeps metadata aside so long descriptions get full width.",
    bestFor: ["Freelancers", "Dev studios", "Consultants"],
    accent: "#0e7490",
    surface: "#ffffff",
    headerStyle: "sidebar",
  },
  {
    slug: "mono",
    name: "Mono",
    industry: "Software",
    tagline: "Stark black-and-white precision.",
    description:
      "Mono is the software and engineering template: thin top band, high-contrast ink and no decorative colour — invoices that feel like technical documents.",
    bestFor: ["Developers", "Engineers", "SaaS tools"],
    accent: "#18181b",
    surface: "#ffffff",
    headerStyle: "band",
  },
];

export const TEMPLATE_COUNT = TEMPLATES.length;

export const TEMPLATE_NAME_LIST = TEMPLATES.map((t) => t.name).join(", ");

export const getTemplate = (slug: string) => TEMPLATES.find((t) => t.slug === slug);

/** Unique industries in display order (first occurrence in TEMPLATES). */
export function getIndustries(): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const t of TEMPLATES) {
    if (!seen.has(t.industry)) {
      seen.add(t.industry);
      list.push(t.industry);
    }
  }
  return list;
}

export function getTemplatesByIndustry(industry: string) {
  return TEMPLATES.filter((t) => t.industry === industry);
}
