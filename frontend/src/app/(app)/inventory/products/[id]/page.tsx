"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { useProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { ConfirmationModal, useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { format } from "date-fns";

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

  const [editing, setEditing] = useState(false);

  if (productLoading || !product) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const totalStock = product.variants.reduce((s, v) => s + v.total_stock, 0);
  const totalReserved = product.variants.reduce(
    (s, v) => s + v.stock_by_warehouse.reduce((a, w) => a + w.quantity_reserved, 0), 0
  );
  const totalAvailable = totalStock - totalReserved;
  const minPrice = Math.min(...product.variants.map(v => v.selling_price));
  const maxPrice = Math.max(...product.variants.map(v => v.selling_price));
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
                {/* Description */}
                {product.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Description</h4>
                    <p className="text-sm text-foreground leading-relaxed">{product.description}</p>
                  </div>
                )}

                {/* Product Info */}
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

                {/* Metadata */}
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
                            <img key={img.id} src={img.image_url} alt="" className="w-12 h-12 object-cover rounded-lg border border-border shrink-0" />
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

      <ConfirmationModal />
    </>
  );
}
