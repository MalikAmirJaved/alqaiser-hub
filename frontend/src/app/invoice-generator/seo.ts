import { SITE } from "./site";

/**
 * Absolute self-referencing canonical URL.
 * Home uses a trailing slash to match the URL Next actually serves;
 * every other path has no trailing slash.
 */
export function canonicalFor(path: string = "/"): string {
  const base = SITE.url.replace(/\/$/, "");
  if (!path || path === "/") {
    return `${base}/`;
  }
  const normalized = (path.startsWith("/") ? path : `/${path}`).replace(/\/$/, "");
  return `${base}${normalized}`;
}

/** Stable site logo — always crawlable static asset. */
export function siteLogoUrl(): string {
  return `${SITE.url.replace(/\/$/, "")}/invoice_logo.png`;
}

/** Absolute URL for a path under the site origin. */
export function absoluteUrl(path: string): string {
  return canonicalFor(path === "/" ? "/" : path);
}

/** Free web-app offer. Kept minimal: no shipping or return policy, which do not apply to a free browser tool. */
export function digitalOffer(options: {
  url: string;
  priceCurrency?: string;
  price?: string | number;
}) {
  return {
    "@type": "Offer" as const,
    url: options.url,
    price: String(options.price ?? "0"),
    priceCurrency: options.priceCurrency ?? "USD",
    availability: "https://schema.org/InStock",
  };
}

/** Image list Google can crawl for Product / SoftwareApplication. */
export function schemaImages(...urls: (string | undefined)[]) {
  const logo = siteLogoUrl();
  const unique = [...new Set(urls.filter(Boolean) as string[])];
  if (!unique.includes(logo)) unique.push(logo);
  return unique;
}
