import type { CSSProperties } from "react";
import { getLocale } from "./locales";
import {
  computeTotals,
  formatMoney,
  resolveTypographyStyles,
  type InvoiceData,
} from "./invoice";
import { TEMPLATES, type InvoiceTemplate } from "./templates";

/**
 * Print-accurate invoice document.
 *
 * Everything is inline-styled with hex colours on purpose: the same DOM node is
 * rasterised by html2canvas for the PDF export, which cannot parse oklch()
 * values coming from the app's design tokens.
 */

export const PAGE_WIDTH = 794; // A4 @ 96dpi

const A = {
  ink: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
};

function tpl(slug: string): InvoiceTemplate {
  return TEMPLATES.find((t) => t.slug === slug) ?? TEMPLATES[0]!;
}

export function InvoicePreview({
  data,
  id = "invoice-document",
  documentTitle = "Invoice",
}: {
  data: InvoiceData;
  id?: string;
  documentTitle?: "Invoice" | "Quote";
}) {
  const t = tpl(data.templateSlug);
  const accent = data.accentColor?.trim() || t.accent;
  const totals = computeTotals(data);
  const ty = resolveTypographyStyles(data.typography, Boolean(t.serif));
  const locale = getLocale(data.localeSlug);
  const taxIdLabel = locale?.taxIdLabel ?? "Tax ID";
  const taxIdSecondaryLabel = locale?.taxIdSecondaryLabel ?? "Tax ID (2)";
  const money = (n: number) => formatMoney(n, data.currency);

  const titleFs = (fallback: number) => ty.titleSize ?? fallback;
  const titleFw = (fallback: number) => ty.titleWeight ?? fallback;
  const bodyFw = (fallback: number) => ty.bodyWeight ?? fallback;

  const headerBg = accent;
  const isSidebar = t.headerStyle === "sidebar";

  const label: CSSProperties = {
    fontSize: ty.labelSize,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: A.muted,
    fontWeight: titleFw(700),
    margin: 0,
  };

  const logo = data.logo ? (
    <img
      src={data.logo}
      alt=""
      style={{ maxHeight: 56, maxWidth: 190, objectFit: "contain", display: "block" }}
    />
  ) : null;

  const partyBlock = (title: string, p: InvoiceData["from"]) => (
    <div style={{ maxWidth: 260 }}>
      <p style={label}>{title}</p>
      <p
        style={{
          margin: "6px 0 0",
          fontWeight: titleFw(700),
          fontSize: ty.sz(14),
          color: A.ink,
        }}
      >
        {p.name || "—"}
      </p>
      {p.address ? (
        <p
          style={{
            margin: "3px 0 0",
            fontSize: ty.smallSize,
            color: A.muted,
            whiteSpace: "pre-line",
            fontWeight: bodyFw(400),
          }}
        >
          {p.address}
        </p>
      ) : null}
      {p.email ? (
        <p style={{ margin: "3px 0 0", fontSize: ty.smallSize, color: A.muted, fontWeight: bodyFw(400) }}>
          {p.email}
        </p>
      ) : null}
      {p.phone ? (
        <p style={{ margin: "3px 0 0", fontSize: ty.smallSize, color: A.muted, fontWeight: bodyFw(400) }}>
          {p.phone}
        </p>
      ) : null}
      {p.taxId ? (
        <p style={{ margin: "3px 0 0", fontSize: ty.smallSize, color: A.muted, fontWeight: bodyFw(400) }}>
          {taxIdLabel}: {p.taxId}
        </p>
      ) : null}
      {p.taxIdSecondary ? (
        <p style={{ margin: "3px 0 0", fontSize: ty.smallSize, color: A.muted, fontWeight: bodyFw(400) }}>
          {taxIdSecondaryLabel}: {p.taxIdSecondary}
        </p>
      ) : null}
    </div>
  );

  const meta = (
    <div style={{ display: "grid", gap: 6 }}>
      <div>
        <p style={label}>{documentTitle} #</p>
        <p style={{ margin: 0, fontSize: ty.bodySize, fontWeight: titleFw(700), color: A.ink }}>
          {data.invoiceNumber || "—"}
        </p>
      </div>
      <div>
        <p style={label}>Issued</p>
        <p style={{ margin: 0, fontSize: ty.bodySize, color: A.ink, fontWeight: bodyFw(400) }}>
          {data.issueDate}
        </p>
      </div>
      <div>
        <p style={label}>Due</p>
        <p style={{ margin: 0, fontSize: ty.bodySize, color: A.ink, fontWeight: bodyFw(400) }}>
          {data.dueDate}
        </p>
      </div>
      {data.poNumber ? (
        <div>
          <p style={label}>PO number</p>
          <p style={{ margin: 0, fontSize: ty.bodySize, color: A.ink, fontWeight: bodyFw(400) }}>
            {data.poNumber}
          </p>
        </div>
      ) : null}
    </div>
  );

  const header = () => {
    switch (t.headerStyle) {
      case "bar":
        return (
          <div
            style={{
              background: headerBg,
              color: "#ffffff",
              padding: "26px 40px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div>
              {logo}
              <p
                style={{
                  margin: logo ? "10px 0 0" : 0,
                  fontSize: ty.businessSize,
                  fontWeight: titleFw(700),
                }}
              >
                {data.from.name || "Your business"}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: titleFs(30),
                  fontWeight: titleFw(800),
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {documentTitle}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: ty.bodySize, opacity: 0.9, fontWeight: bodyFw(400) }}>
                #{data.invoiceNumber || "—"}
              </p>
            </div>
          </div>
        );
      case "split":
        return (
          <div style={{ display: "flex", borderBottom: `3px solid ${accent}` }}>
            <div style={{ flex: 1, padding: "28px 40px" }}>
              {logo}
              <p
                style={{
                  margin: logo ? "10px 0 0" : 0,
                  fontSize: ty.businessSize,
                  fontWeight: titleFw(700),
                  color: A.ink,
                }}
              >
                {data.from.name || "Your business"}
              </p>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: ty.smallSize,
                  color: A.muted,
                  whiteSpace: "pre-line",
                  fontWeight: bodyFw(400),
                }}
              >
                {data.from.address}
              </p>
            </div>
            <div
              style={{
                width: 250,
                padding: "28px 40px 28px 24px",
                background: `${accent}12`,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: titleFs(26),
                  fontWeight: titleFw(800),
                  color: accent,
                  textTransform: "uppercase",
                }}
              >
                {documentTitle}
              </p>
              <div style={{ marginTop: 10 }}>{meta}</div>
            </div>
          </div>
        );
      case "stacked":
        return (
          <div
            style={{
              padding: "34px 40px 26px",
              background: `linear-gradient(120deg, ${accent}1a, ${accent}05)`,
              borderBottom: `1px solid ${A.line}`,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>{logo}</div>
            <p
              style={{
                margin: logo ? "12px 0 0" : 0,
                fontSize: titleFs(28),
                fontWeight: titleFw(700),
                color: accent,
                fontFamily: ty.fontFamily,
                letterSpacing: t.serif ? "0.02em" : "0.06em",
                textTransform: "uppercase",
              }}
            >
              {documentTitle}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: ty.bodySize, color: A.muted, fontWeight: bodyFw(400) }}>
              {data.from.name} · #{data.invoiceNumber || "—"}
            </p>
          </div>
        );
      case "band":
        return (
          <div>
            <div style={{ height: 8, background: accent }} />
            <div
              style={{
                padding: "28px 40px 22px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 20,
                borderBottom: `1px solid ${A.line}`,
              }}
            >
              <div>
                {logo}
                <p
                  style={{
                    margin: logo ? "10px 0 0" : 0,
                    fontSize: ty.businessSize,
                    fontWeight: titleFw(700),
                    color: A.ink,
                  }}
                >
                  {data.from.name || "Your business"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: titleFs(ty.sz(13)),
                    fontWeight: titleFw(700),
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: accent,
                  }}
                >
                  {documentTitle}
                </p>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: titleFs(20),
                    fontWeight: titleFw(800),
                    color: A.ink,
                  }}
                >
                  #{data.invoiceNumber || "—"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: ty.smallSize, color: A.muted, fontWeight: bodyFw(400) }}>
                  Due {data.dueDate || "—"}
                </p>
              </div>
            </div>
          </div>
        );
      case "corner":
        return (
          <div style={{ position: "relative", padding: "32px 40px 24px", overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 220,
                height: 220,
                background: accent,
                clipPath: "polygon(40% 0, 100% 0, 100% 100%)",
              }}
            />
            <div
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
              }}
            >
              <div>
                {logo}
                <p
                  style={{
                    margin: logo ? "10px 0 0" : 0,
                    fontSize: ty.businessSize,
                    fontWeight: titleFw(700),
                    color: A.ink,
                  }}
                >
                  {data.from.name || "Your business"}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: ty.smallSize,
                    color: A.muted,
                    whiteSpace: "pre-line",
                    fontWeight: bodyFw(400),
                  }}
                >
                  {data.from.address}
                </p>
              </div>
              <div style={{ textAlign: "right", color: "#ffffff", paddingTop: 8, minWidth: 140 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: titleFs(28),
                    fontWeight: titleFw(800),
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {documentTitle}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: ty.bodySize, opacity: 0.95, fontWeight: bodyFw(400) }}>
                  #{data.invoiceNumber || "—"}
                </p>
              </div>
            </div>
            <div style={{ marginTop: 18, borderTop: `2px solid ${accent}`, paddingTop: 14 }}>
              {meta}
            </div>
          </div>
        );
      case "minimal":
      default:
        return (
          <div style={{ padding: "36px 40px 22px", borderBottom: `2px solid ${A.ink}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                {logo}
                <p
                  style={{
                    margin: logo ? "10px 0 0" : 0,
                    fontSize: titleFs(24),
                    fontWeight: titleFw(700),
                    color: A.ink,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  {documentTitle}
                </p>
              </div>
              <div style={{ textAlign: "right", fontSize: ty.smallSize, color: A.muted }}>
                <p style={{ margin: 0, fontWeight: titleFw(700), color: A.ink }}>{data.from.name}</p>
                <p style={{ margin: "3px 0 0", fontWeight: bodyFw(400) }}>#{data.invoiceNumber || "—"}</p>
                <p style={{ margin: "3px 0 0", fontWeight: bodyFw(400) }}>
                  {data.issueDate} → {data.dueDate}
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  const itemsTable = (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ty.tableSize }}>
      <thead>
        <tr
          style={{
            background: t.headerStyle === "minimal" ? "transparent" : `${accent}12`,
            borderBottom: `1px solid ${accent}55`,
          }}
        >
          <th
            style={{
              textAlign: "left",
              padding: "9px 10px",
              color: A.ink,
              fontWeight: titleFw(700),
            }}
          >
            Description
          </th>
          <th
            style={{
              textAlign: "right",
              padding: "9px 10px",
              color: A.ink,
              fontWeight: titleFw(700),
              width: 70,
            }}
          >
            Qty
          </th>
          <th
            style={{
              textAlign: "right",
              padding: "9px 10px",
              color: A.ink,
              fontWeight: titleFw(700),
              width: 100,
            }}
          >
            Rate
          </th>
          <th
            style={{
              textAlign: "right",
              padding: "9px 10px",
              color: A.ink,
              fontWeight: titleFw(700),
              width: 110,
            }}
          >
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((item, i) => (
          <tr
            key={item.id}
            style={{
              borderBottom: `1px solid ${A.line}`,
              background: t.slug === "blue" && i % 2 === 1 ? "#f8fafc" : "transparent",
            }}
          >
            <td style={{ padding: "10px", color: A.ink, fontWeight: bodyFw(400) }}>
              {item.description || "—"}
            </td>
            <td style={{ padding: "10px", textAlign: "right", color: A.muted, fontWeight: bodyFw(400) }}>
              {item.quantity}
            </td>
            <td style={{ padding: "10px", textAlign: "right", color: A.muted, fontWeight: bodyFw(400) }}>
              {money(item.rate)}
            </td>
            <td
              style={{
                padding: "10px",
                textAlign: "right",
                color: A.ink,
                fontWeight: bodyFw(600),
              }}
            >
              {money((Number(item.quantity) || 0) * (Number(item.rate) || 0))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const totalsRow = (name: string, value: string, strong = false) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        fontSize: strong ? ty.totalSize : ty.tableSize,
        fontWeight: strong ? titleFw(800) : bodyFw(500),
        color: strong ? A.ink : A.muted,
      }}
    >
      <span>{name}</span>
      <span style={{ color: A.ink }}>{value}</span>
    </div>
  );

  const totalsPanel = (
    <div style={{ width: 268 }}>
      {totalsRow("Subtotal", money(totals.subtotal))}
      {totals.discountAmount > 0 && totalsRow("Discount", `−${money(totals.discountAmount)}`)}
      {totalsRow(`Tax (${data.taxRate || 0}%)`, money(totals.taxAmount))}
      {totals.shipping > 0 && totalsRow("Shipping", money(totals.shipping))}
      <div
        style={{
          borderTop: `2px solid ${accent}`,
          marginTop: 6,
          paddingTop: 6,
          background: t.slug === "creative" ? `${accent}10` : "transparent",
        }}
      >
        {totalsRow("Total", money(totals.total), true)}
      </div>
      {(Number(data.amountPaid) || 0) > 0 && (
        <>
          {totalsRow("Amount paid", `−${money(Number(data.amountPaid) || 0)}`)}
          {totalsRow("Balance due", money(totals.balanceDue), true)}
        </>
      )}
    </div>
  );

  const footer = (
    <div style={{ display: "flex", gap: 28, marginTop: 30, alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>
        {data.notes ? (
          <>
            <p style={label}>Notes</p>
            <p
              style={{
                margin: "5px 0 0",
                fontSize: ty.smallSize,
                color: A.muted,
                whiteSpace: "pre-line",
                fontStyle: ty.notesStyle,
                fontWeight: bodyFw(400),
              }}
            >
              {data.notes}
            </p>
          </>
        ) : null}
        {data.terms ? (
          <div style={{ marginTop: 14 }}>
            <p style={label}>Terms</p>
            <p
              style={{
                margin: "5px 0 0",
                fontSize: ty.smallSize,
                color: A.muted,
                whiteSpace: "pre-line",
                fontStyle: ty.notesStyle,
                fontWeight: bodyFw(400),
              }}
            >
              {data.terms}
            </p>
          </div>
        ) : null}
      </div>
      <div style={{ width: 210, textAlign: "center" }}>
        {data.signature ? (
          <img
            src={data.signature}
            alt=""
            style={{
              maxHeight: 60,
              maxWidth: 200,
              objectFit: "contain",
              margin: "0 auto",
              display: "block",
            }}
          />
        ) : (
          <div style={{ height: 60 }} />
        )}
        <div style={{ borderTop: `1px solid ${A.ink}`, marginTop: 4, paddingTop: 5 }}>
          <p style={{ margin: 0, fontSize: ty.sz(11), color: A.muted, fontWeight: bodyFw(400) }}>
            Authorised signature
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div
      id={id}
      data-invoice-template={t.slug}
      style={{
        position: "relative",
        width: PAGE_WIDTH,
        minHeight: 1123,
        background: t.surface,
        color: A.ink,
        fontFamily: ty.fontFamily,
        fontSize: ty.bodySize,
        fontWeight: bodyFw(400),
        fontStyle: ty.bodyStyle,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {data.watermarkEnabled && (data.watermarkImage || data.watermarkText.trim()) ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {data.watermarkImage ? (
            <img
              src={data.watermarkImage}
              alt=""
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) rotate(-28deg)",
                maxWidth: "58%",
                maxHeight: "58%",
                objectFit: "contain",
                opacity: Math.min(Math.max(data.watermarkOpacity, 0.04), 0.45),
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) rotate(-32deg)",
                fontSize: ty.sz(78),
                fontWeight: titleFw(800),
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                color: `rgba(17, 24, 39, ${Math.min(Math.max(data.watermarkOpacity, 0.04), 0.45)})`,
                userSelect: "none",
              }}
            >
              {data.watermarkText.trim()}
            </div>
          )}
        </div>
      ) : null}

      {!isSidebar && header()}

      {isSidebar ? (
        <div style={{ display: "flex", flex: 1 }}>
          <div
            style={{
              width: 210,
              background: accent,
              color: "#ffffff",
              padding: "32px 22px",
            }}
          >
            {logo}
            <p
              style={{
                margin: logo ? "14px 0 0" : 0,
                fontSize: titleFs(22),
                fontWeight: titleFw(800),
                textTransform: "uppercase",
              }}
            >
              {documentTitle}
            </p>
            <div style={{ marginTop: 18, fontSize: ty.smallSize, lineHeight: 1.6 }}>
              <p style={{ margin: 0, opacity: 0.75 }}>{documentTitle} #</p>
              <p style={{ margin: "0 0 12px", fontWeight: titleFw(700) }}>{data.invoiceNumber || "—"}</p>
              <p style={{ margin: 0, opacity: 0.75 }}>Issued</p>
              <p style={{ margin: "0 0 12px", fontWeight: titleFw(700) }}>{data.issueDate}</p>
              <p style={{ margin: 0, opacity: 0.75 }}>Due</p>
              <p style={{ margin: "0 0 12px", fontWeight: titleFw(700) }}>{data.dueDate}</p>
              <p style={{ margin: 0, opacity: 0.75 }}>Total</p>
              <p style={{ margin: 0, fontWeight: titleFw(800), fontSize: ty.sz(16) }}>
                {money(totals.total)}
              </p>
            </div>
          </div>
          <div style={{ flex: 1, padding: "32px 34px" }}>
            <div style={{ display: "flex", gap: 26, justifyContent: "space-between" }}>
              {partyBlock("From", data.from)}
              {partyBlock("Bill to", data.to)}
            </div>
            <div style={{ marginTop: 26 }}>{itemsTable}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              {totalsPanel}
            </div>
            {footer}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, padding: "30px 40px 40px" }}>
          <div style={{ display: "flex", gap: 26, justifyContent: "space-between" }}>
            {partyBlock("From", data.from)}
            {partyBlock("Bill to", data.to)}
            {t.headerStyle !== "split" && t.headerStyle !== "corner" ? meta : null}
          </div>

          {t.slug === "creative" ? (
            <div
              style={{
                marginTop: 24,
                padding: "16px 20px",
                background: `${accent}12`,
                borderLeft: `5px solid ${accent}`,
              }}
            >
              <p style={label}>Amount due</p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: ty.heroSize,
                  fontWeight: titleFw(800),
                  color: accent,
                }}
              >
                {money(totals.balanceDue)}
              </p>
            </div>
          ) : null}

          <div style={{ marginTop: 24 }}>{itemsTable}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            {totalsPanel}
          </div>
          {footer}
        </div>
      )}
    </div>
  );
}
