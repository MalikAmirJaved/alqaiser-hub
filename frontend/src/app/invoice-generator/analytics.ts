/**
 * Lightweight, consent-aware analytics + AdSense loader.
 *
 * Both integrations are optional: nothing is loaded unless the corresponding
 * environment variable is present AND the visitor has accepted cookies.
 *
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID  e.g. G-XXXXXXXXXX
 *   NEXT_PUBLIC_ADSENSE_CLIENT     e.g. ca-pub-9252917783014745
 */

export const CONSENT_KEY = "invoicecreator:cookie-consent:v1";
const LEGACY_CONSENT_KEY = "invoiceforge:cookie-consent:v1";

export type ConsentValue = "accepted" | "rejected";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    adsbygoogle?: unknown[];
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
/** Publisher client — env override, otherwise the live AdSense account. */
export const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-9252917783014745";

export function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v =
      window.localStorage.getItem(CONSENT_KEY) ??
      window.localStorage.getItem(LEGACY_CONSENT_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: ConsentValue) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* storage unavailable */
  }
}

function injectScript(src: string, attrs: Record<string, string> = {}) {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${src}"]`)) return;
  const el = document.createElement("script");
  el.async = true;
  el.src = src;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  document.head.appendChild(el);
}

let gaReady = false;

/** Loads gtag.js once. Safe to call repeatedly. */
export function initAnalytics() {
  if (gaReady || !GA_ID || typeof window === "undefined") return;
  gaReady = true;
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false, anonymize_ip: true });
}

/** Loads the AdSense library once (only with consent + a configured client). */
export function initAdSense() {
  if (!ADSENSE_CLIENT || typeof window === "undefined") return;
  injectScript(
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`,
    { crossorigin: "anonymous" },
  );
}

export function trackPageview(path: string, title?: string) {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title ?? document.title,
    page_location: window.location.href,
  });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

/** True when third-party scripts are allowed to run. */
export function analyticsAllowed() {
  return getConsent() === "accepted";
}
