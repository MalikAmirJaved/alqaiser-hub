"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { useProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useProductRelatedData } from "@/hooks/useProductRelatedData";
import { format } from "date-fns";
import { BASE_URL } from "@/lib/api";
import DocumentViewer from "@/components/reuseable/DocumentViewer";
import { ArrowUpRight, User, Building2 } from "lucide-react";

export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const formatCurrency = useFormatCurrency();
  const { data: product, isLoading: productLoading } = useProduct(id);
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const permissions = useFeaturePermissions("INVENTORY", "product");
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const deleteConfirm = useConfirmationModal();
  const { data: relatedData, isLoading: relatedLoading } = useProductRelatedData(id);

  const [editing, setEditing] = useState(false);
  const [docViewer, setDocViewer] = useState<{ open: boolean; url: string; filename?: string; mimeType?: string; title?: string }>({ open: false, url: "" });

  if (productLoading || !product) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const totalStock = product.variants.reduce((s, v) => s + v.total_stock, 0);
  const totalReserved = product.variants.reduce(
    (s, v) => s + v.stock_by_warehouse.reduce((a, w) => a + w.quantity_reserved, 0), 0
  );
  const totalAvailable = totalStock - totalReserved;
  const minPrice = product.variants.length > 0 ? Math.min(...product.variants.map(v => v.selling_price)) : 0;
  const maxPrice = product.variants.length > 0 ? Math.max(...product.variants.map(v => v.selling_price)) : 0;
  const categoryName = categories.find(c => c.id === product.category_id)?.name || "—";
  const brandName = brands.find(b => b.id === product.brand_id)?.name || "—";

  const handleDelete = () => {
    deleteConfirm.confirm({
      title: "Delete Product",
      message: `Delete "${product.product_name}"? This removes all variants and stock.`,
      onConfirm: async () => {
        await deleteProduct.mutateAsync(product.id);
        router.push("/inventory/products");
      },
    });
  };

  const priceDisplay = minPrice === maxPrice
    ? formatCurrency(minPrice)
    : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`;

  return (
    <>
      <DetailLayout
        breadcrumbs={["Inventory", "Products", product.product_name]}
        entityId={`${product.variants[0]?.sku || product.id}`}
        title={product.product_name}
        status={product.status}
        subtitle={product.description ? product.description.slice(0, 100) + (product.description.length > 100 ? "..." : "") : undefined}
        data={product}
        meta={[
          { label: "Category", value: categoryName },
          { label: "Brand", value: brandName },
          { label: "Variants", value: String(product.variants.length) },
          { label: "Unit", value: product.unit || "—" },
        ]}
        summary={[
          {
            label: "Total Stock",
            value: totalStock,
            tone: totalStock > 0 ? "success" : "destructive",
          },
          {
            label: "Reserved",
            value: totalReserved,
            tone: totalReserved > 0 ? "warning" : "info",
          },
          {
            label: "Available",
            value: totalAvailable,
            tone: totalAvailable > 0 ? "success" : totalAvailable === 0 ? "destructive" : "info",
          },
          {
            label: "Price Range",
            value: priceDisplay,
            isCurrency: true,
          },
        ]}
        onEdit={permissions.update ? () => setEditing(true) : undefined}
        permissions={{ edit: permissions.update }}
        tabs={[
          {
            id: "details",
            label: "Details",
            render: () => (
              <div className="space-y-6">
                {product.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Description</h4>
                    <p className="text-sm text-foreground leading-relaxed">{product.description}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Product Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      ["Category", categoryName],
                      ["Brand", brandName],
                      ["Unit", product.unit || "—"],
                      ["Storage", product.storage_requirement || "—"],
                      ["Tax Rate", `${product.tax_rate}%`],
                      ["Status", product.status],
                      ["Active", product.is_active ? "Yes" : "No"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">System Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      ["Created by", product.created_by_name || "System"],
                      ["Created", format(new Date(product.created_at), "dd MMM yyyy, HH:mm")],
                      ["Updated by", product.updated_by_name || "System"],
                      ["Last Updated", format(new Date(product.updated_at), "dd MMM yyyy, HH:mm")],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "variants",
            label: "Variants",
            count: product.variants.length,
            render: () =>
              product.variants.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No variants</div>
              ) : (
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
                          <p className="text-sm font-bold text-success">{formatCurrency(v.selling_price)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{v.total_stock} in stock</p>
                        </div>
                      </div>
                      {v.variant_images.length > 0 && (
                        <div className="px-4 py-3 flex gap-2 border-t border-border/40 overflow-x-auto">
                          {v.variant_images.map((img) => (
                            <img
                              key={img.id}
                              src={`${BASE_URL}${img.image_url_thumb || img.image_url}`}
                              alt=""
                              className="w-12 h-12 object-cover rounded-lg border border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setDocViewer({ open: true, url: img.image_url, filename: `Variant Image`, mimeType: "image/jpeg", title: `${v.sku} Image` })}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ),
          },
          {
            id: "stock",
            label: "Stock",
            render: () => {
              const allWarehouseEntries = product.variants.flatMap(v =>
                v.stock_by_warehouse.map(sw => ({ ...sw, sku: v.sku }))
              );
              return allWarehouseEntries.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No stock records</div>
              ) : (
                <div className="space-y-3">
                  {allWarehouseEntries.map((entry, i) => (
                    <div key={`${entry.warehouse_id}-${i}`} className="flex items-center justify-between p-4 border border-border rounded-xl">
                      <div>
                        <p className="text-sm font-semibold">{entry.sku}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.warehouse_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{entry.quantity_on_hand} on hand</p>
                        <p className="text-xs text-muted-foreground">{entry.quantity_reserved} reserved</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            },
          },
          // ── Stock Movements ─────────────────────────────────
          {
            id: "stock-movements",
            label: "Stock Movements",
            count: relatedData?.stock_movements.length,
            render: () => {
              if (relatedLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
              const items = relatedData?.stock_movements ?? [];
              if (items.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">No stock movements found</div>;
              return (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Date</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Type</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Variant SKU</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Change</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Before</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">After</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Warehouse</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Reason</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{format(new Date(m.created_at), "dd MMM HH:mm")}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              m.transaction_type === 'PURCHASE_RECEIPT' ? 'bg-success/10 text-success border-success/20' :
                              m.transaction_type === 'SALE' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              m.transaction_type === 'RETURN_IN' ? 'bg-info/10 text-info border-info/20' :
                              m.transaction_type === 'TRANSFER_IN' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                              m.transaction_type === 'TRANSFER_OUT' ? 'bg-warning/10 text-warning border-warning/20' :
                              'bg-muted text-muted-foreground border-border'
                            }`}>
                              {m.transaction_type_display}
                            </span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{m.variant_sku}</td>
                          <td className={`py-2 pr-3 whitespace-nowrap font-mono text-xs font-semibold ${m.quantity_change > 0 ? 'text-success' : 'text-destructive'}`}>
                            {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{m.quantity_before}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{m.quantity_after}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs">{m.warehouse_name}</td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[150px] truncate" title={m.reason_text}>{m.reason_text || '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{m.created_by_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            },
          },
          // ── Purchase Orders ─────────────────────────────────
          {
            id: "purchase-orders",
            label: "Purchase Orders",
            count: relatedData?.purchase_orders.length,
            render: () => {
              if (relatedLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
              const items = relatedData?.purchase_orders ?? [];
              if (items.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">No purchase orders found</div>;
              return (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Order #</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Supplier</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Status</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">SKU</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Qty</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Received</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Unit Cost</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Date</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">By</th>
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((po) => (
                        <tr key={po.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{po.order_number}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                              {po.supplier_name || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              po.status === 'FULLY_RECEIVED' ? 'bg-success/10 text-success border-success/20' :
                              po.status === 'PARTIALLY_RECEIVED' ? 'bg-warning/10 text-warning border-warning/20' :
                              po.status === 'DRAFT' ? 'bg-muted text-muted-foreground border-border' :
                              po.status === 'CANCELLED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              'bg-info/10 text-info border-info/20'
                            }`}>{po.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{po.variant_sku}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{po.quantity_ordered}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{po.quantity_received}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{formatCurrency(Number(po.unit_cost))}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{po.order_date ? format(new Date(po.order_date), "dd MMM yyyy") : '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{po.created_by_name || '—'}</td>
                          <td className="py-2">
                            <button
                              onClick={() => router.push(`/inventory/purchases/${po.order_id}`)}
                              className="text-primary hover:text-primary/80 transition-colors"
                              title="View purchase order"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            },
          },
          // ── Sales Orders (POS) ───────────────────────────────
          {
            id: "sales-orders",
            label: "Sales Orders",
            count: relatedData?.sales_orders.length,
            render: () => {
              if (relatedLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
              const items = relatedData?.sales_orders ?? [];
              if (items.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">No sales orders found</div>;
              return (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Order #</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Customer</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Source</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Status</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">SKU</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Qty</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Unit Price</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Date</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((so) => (
                        <tr key={so.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{so.order_number}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {so.customer_name || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{so.source?.replace(/_/g, ' ')}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              so.status === 'COMPLETE' ? 'bg-success/10 text-success border-success/20' :
                              so.status === 'DRAFT' ? 'bg-muted text-muted-foreground border-border' :
                              so.status === 'CANCELLED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              'bg-warning/10 text-warning border-warning/20'
                            }`}>{so.status}</span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{so.variant_sku}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{so.quantity_ordered}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{formatCurrency(Number(so.unit_price))}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{so.order_date ? format(new Date(so.order_date), "dd MMM yyyy") : '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{so.created_by_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            },
          },
          // ── Quotes ───────────────────────────────────────────
          {
            id: "quotes",
            label: "Quotes",
            count: relatedData?.quotes.length,
            render: () => {
              if (relatedLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
              const items = relatedData?.quotes ?? [];
              if (items.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">No quotes found</div>;
              return (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Quote #</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Customer</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Status</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">SKU</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Qty</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Unit Price</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Discount</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Date</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">By</th>
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((q) => (
                        <tr key={q.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{q.quote_number}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {q.customer_name || q.lead_name || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              q.status === 'APPROVED' ? 'bg-success/10 text-success border-success/20' :
                              q.status === 'CONVERTED' ? 'bg-info/10 text-info border-info/20' :
                              q.status === 'REJECTED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              q.status === 'DRAFT' ? 'bg-muted text-muted-foreground border-border' :
                              'bg-warning/10 text-warning border-warning/20'
                            }`}>{q.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{q.variant_sku}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{q.quantity}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{formatCurrency(Number(q.unit_price))}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs text-destructive">{Number(q.discount_amount) > 0 ? formatCurrency(Number(q.discount_amount)) : '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{q.date ? format(new Date(q.date), "dd MMM yyyy") : '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{q.created_by_name || '—'}</td>
                          <td className="py-2">
                            <button
                              onClick={() => router.push(`/sales/quotes/${q.quote_id}`)}
                              className="text-primary hover:text-primary/80 transition-colors"
                              title="View quote"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            },
          },
          // ── Invoices ─────────────────────────────────────────
          {
            id: "invoices",
            label: "Invoices",
            count: relatedData?.invoices.length,
            render: () => {
              if (relatedLoading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
              const items = relatedData?.invoices ?? [];
              if (items.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">No invoices found</div>;
              return (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Invoice #</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Customer</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Source</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Status</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">SKU</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Qty</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Unit Price</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Cost</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">Date</th>
                        <th className="pb-2 pr-3 text-xs text-muted-foreground font-medium whitespace-nowrap">By</th>
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((inv) => (
                        <tr key={inv.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{inv.invoice_number}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {inv.customer_name || '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{inv.source?.replace(/_/g, ' ')}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              inv.status === 'SENT' ? 'bg-info/10 text-info border-info/20' :
                              inv.status === 'CANCELLED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              inv.status === 'DRAFT' ? 'bg-muted text-muted-foreground border-border' :
                              'bg-warning/10 text-warning border-warning/20'
                            }`}>{inv.status}</span>
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{inv.variant_sku}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{inv.quantity}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{formatCurrency(Number(inv.unit_price))}</td>
                          <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs text-muted-foreground">{inv.cost_price ? formatCurrency(Number(inv.cost_price)) : '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{inv.invoice_date ? format(new Date(inv.invoice_date), "dd MMM yyyy") : '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{inv.created_by_name || '—'}</td>
                          <td className="py-2">
                            <button
                              onClick={() => router.push(`/finance/customer-invoices/${inv.invoice_id}`)}
                              className="text-primary hover:text-primary/80 transition-colors"
                              title="View invoice"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            },
          },
        ]}
        sidebar={
          <StandardSidebar
            metadata={[
              ["Product Name", product.product_name],
              ["Category", categoryName],
              ["Brand", brandName],
              ["Unit", product.unit || "—"],
              ["Status", product.status],
              ["Active", product.is_active ? "Yes" : "No"],
              ["Tax Rate", `${product.tax_rate}%`],
              ["Variants", String(product.variants.length)],
              ["Total Stock", String(totalStock)],
              ["Created", format(new Date(product.created_at), "dd MMM yyyy")],
              ["Updated", format(new Date(product.updated_at), "dd MMM yyyy")],
            ]}
          />
        }
      />

      <deleteConfirm.Modal />

      <DocumentViewer
        open={docViewer.open}
        onClose={() => setDocViewer({ open: false, url: "" })}
        url={docViewer.url}
        filename={docViewer.filename}
        mimeType={docViewer.mimeType}
        title={docViewer.title}
      />
    </>
  );
}
