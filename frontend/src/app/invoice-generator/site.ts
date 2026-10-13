export const SITE = {
  name: "Invoice Creator",
  tagline: "Free Invoice Generator",
  description:
    "Create professional invoices online for free. Download high-quality PDF invoices instantly. No signup required.",
  operator: "Next Software Development Company",
  operatorDescription:
    "Invoice Creator is a free online invoice generation service operated by Next Software Development Company, a software development company based in Islamabad, Pakistan.",
  email: "support@nextfreeinvoicegenerator.com",
  phone: "+92 3710510083",
  address: "Islamabad, Pakistan",
  hours: "Monday – Friday, 9:00 – 18:00 (PKT)",
  // Always prefer HTTPS for canonicals, sitemap, and AdSense / Search Console.
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://nextfreeinvoicegenerator.com").replace(
    /^http:\/\//i,
    "https://",
  ),
  /** Only list profiles you actually operate. Empty until real URLs are set. */
  social: [] as { label: string; href: string }[],
};

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Invoice Generator", href: "/invoice-generator" },
  { label: "Templates", href: "/invoice-templates" },
  { label: "User Guide", href: "/user-guide" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;     
