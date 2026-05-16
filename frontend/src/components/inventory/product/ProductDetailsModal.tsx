// src/components/inventory/product/ProductDetailsModal.tsx
"use client";

import { useState } from "react";
import { X, Edit, Package, Layers, Warehouse, TrendingUp, ArrowUpRight } from "lucide-react";
import { Product } from "@/hooks/useProducts";

interface Props {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
}

function StatPill({ label, value, colorClass }: { label: string; value: number | string; colorClass: string }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${colorClass}`}>
      <p className="text-xs font-medium opacity-70 mb-0.5">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0 mr-4 w-32">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-success/15 text-success",
  draft: "bg-warning/15 text-warning",
  archived: "bg-muted/40 text-muted-foreground",
  discontinued: "bg-destructive/15 text-destructive",
};

export default function ProductDetailsModal({ product, onClose, onEdit }: Props) {
  const [tab, setTab] = useState<"info" | "variants" | "stock">("info");

  const totalStock = product.variants.reduce((s, v) => s + v.total_stock, 0);
  const totalReserved = product.variants.reduce(
    (s, v) => s + v.stock_by_warehouse.reduce((a, w) => a + w.quantity_reserved, 0), 0
  );
  const totalAvailable = totalStock - totalReserved;
  const minPrice = Math.min(...product.variants.map(v => parseFloat(v.selling_price)));
  const maxPrice = Math.max(...product.variants.map(v => parseFloat(v.selling_price)));

  const tabs = [
    { id: "info" as const, label: "Details", icon: Package },
    { id: "variants" as const, label: `Variants (${product.variants.length})`, icon: Layers },
    { id: "stock" as const, label: "Stock", icon: Warehouse },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-card rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold truncate">{product.product_name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[product.status] || "bg-muted/40"}`}>
                  {product.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {product.id}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Price range */}
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-primary">
              ${minPrice.toFixed(2)}{minPrice !== maxPrice && ` – $${maxPrice.toFixed(2)}`}
            </span>
            <span className="text-sm text-muted-foreground ml-1">selling price</span>
          </div>

          {/* Stock pills */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <StatPill label="Total Stock" value={totalStock} colorClass="bg-success/10 text-success" />
            <StatPill label="Reserved" value={totalReserved} colorClass="bg-warning/10 text-warning" />
            <StatPill label="Available" value={totalAvailable} colorClass="bg-info/10 text-info" />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-border/60 px-6 gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info */}
          {tab === "info" && (
            <div className="space-y-6">
              {product.description && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Details</h4>
                <div className="bg-muted/10 rounded-xl px-4 py-1">
                  <InfoRow label="Category" value={product.category_id} />
                  <InfoRow label="Brand" value={product.brand_id} />
                  <InfoRow label="Unit" value={product.unit} />
                  <InfoRow label="Storage" value={product.storage_requirement} />
                  <InfoRow label="Tax Rate" value={`${product.tax_rate}%`} />
                  <InfoRow label="Variants" value={product.variants.length} />
                </div>
              </div>
            </div>
          )}

          {/* Variants */}
          {tab === "variants" && (
            <div className="space-y-3">
              {product.variants.map((v) => (
                <div key={v.id} className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-start justify-between px-4 py-3 bg-muted/10">
                    <div>
                      <p className="text-sm font-semibold">
                        {v.variant_attributes.length > 0
                          ? v.variant_attributes.map(a => `${a.attribute_key}: ${a.attribute_value}`).join(" · ")
                          : v.sku}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">SKU: {v.sku}</p>
                      {v.barcode && <p className="text-xs text-muted-foreground">Barcode: {v.barcode}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-bold text-success">${parseFloat(v.selling_price).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground line-through">${parseFloat(v.buying_price).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{v.total_stock} in stock</p>
                    </div>
                  </div>
                  {v.variant_images.length > 0 && (
                    <div className="px-4 py-3 flex gap-2 border-t border-border/40 overflow-x-auto">
                      {v.variant_images.map((img) => (
                        <img key={img.id} src={img.image_url} alt="" className="w-12 h-12 object-cover rounded-lg border border-border shrink-0" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Stock */}
          {tab === "stock" && (
            <div className="space-y-3">
              {product.variants.flatMap((v) =>
                v.stock_by_warehouse.map((sw, i) => (
                  <div key={`${v.id}-${i}`} className="flex items-center justify-between p-4 border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-semibold">{v.sku}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Warehouse className="w-3 h-3" /> {sw.warehouse_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{sw.quantity_on_hand} on hand</p>
                      <p className="text-xs text-muted-foreground">{sw.quantity_reserved} reserved</p>
                    </div>
                  </div>
                ))
              )}
              {product.variants.every((v) => v.stock_by_warehouse.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No stock records yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}