// src/app/(app)/inventory/products/page.tsx
"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Plus, Grid, List, Download } from "lucide-react";
import { TableView, GridView, Column } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import ProductFilters from "@/components/inventory/product/ProductFilters";
import ProductDetailsModal from "@/components/inventory/product/ProductDetailsModal";
import ProductForm from "@/components/inventory/product/ProductForm";
import { useProducts, useDeleteProduct, useCreateProduct, useUpdateProduct, Product, ProductPayload } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { formatCurrency } from "@/lib/currency";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function ProductsPage() {
  const permissions = useFeaturePermissions("INVENTORY", "product");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({ search: "", category: "", brand: "", status: "" });

  const { data: products = [], isLoading, refetch } = useProducts(filters);
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteConfirm = useConfirmationModal();

  const getProductPrice = (p: Product) =>
    p.variants.length ? Math.min(...p.variants.map(v => v.selling_price)) : 0;

  const getTotalStock = (p: Product) =>
    p.variants.reduce((s, v) => s + v.total_stock, 0);

  const enrichedProducts = useMemo(() =>
    products.map(p => ({
      ...p,
      category_name: categories.find(c => c.id === p.category_id)?.name || "—",
      brand_name: brands.find(b => b.id === p.brand_id)?.name || "—",
      display_price: getProductPrice(p),
      total_stock: getTotalStock(p),
      main_image: p.variants[0]?.variant_images.find(i => i.is_primary)?.image_url
        || p.variants[0]?.variant_images[0]?.image_url || "",
    })),
    [products, categories, brands]
  );

  // ── Stats ──
  const stats = useMemo(() => {
    const active = enrichedProducts.filter(p => p.status === "active").length;
    const draft = enrichedProducts.filter(p => p.status === "draft").length;
    const totalStock = enrichedProducts.reduce((s, p) => s + p.total_stock, 0);
    const totalVariants = enrichedProducts.reduce((s, p) => s + p.variants.length, 0);
    return [
      { id: "total", label: "Total Products", value: enrichedProducts.length },
      { id: "active", label: "Active", value: active, valueClassName: "text-success" },
      { id: "draft", label: "Draft", value: draft, valueClassName: "text-warning" },
      { id: "variants", label: "Total Variants", value: totalVariants },
      { id: "stock", label: "Units in Stock", value: totalStock.toLocaleString() },
    ];
  }, [enrichedProducts]);

  const handleCreate = () => { setSelectedProduct(undefined); setShowProductModal(true); };
  const handleEdit = (p: Product) => { setSelectedProduct(p); setShowProductModal(true); };
  const handleViewDetails = (p: Product) => { setSelectedProduct(p); setShowDetailsModal(true); };

  const handleDelete = (p: Product) => {
    deleteConfirm.confirm({
      title: "Delete Product",
      message: `Delete "${p.product_name}"? This removes all variants and stock.`,
      onConfirm: async () => {
        await deleteProduct.mutateAsync(p.id);
        toast.success(`"${p.product_name}" deleted`);
        refetch();
      },
    });
  };

  const handleSave = async (data: ProductPayload) => {
    if (selectedProduct) {
      await updateProduct.mutateAsync({ id: selectedProduct.id, ...data });
      toast.success(`"${data.productName}" updated`);
    } else {
      await createProduct.mutateAsync(data);
      toast.success(`"${data.productName}" created`);
    }
    setShowProductModal(false);
    refetch();
  };

  const handleExport = () => {
    if (!enrichedProducts.length) return;
    const rows = enrichedProducts.map(p => ({
      SKU: p.variants[0]?.sku || "",
      Name: p.product_name,
      Category: p.category_name,
      Brand: p.brand_name,
      Price: p.display_price,
      Stock: p.total_stock,
      Status: p.status,
    }));
    const csv = [Object.keys(rows[0]), ...rows.map(Object.values)]
      .map(row => row.map(c => `"${c}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })),
      download: `products_${new Date().toISOString().split("T")[0]}.csv`,
    });
    a.click();
  };

  // ── Table columns ──
  const columns: Column<any>[] = [
    {
      key: "main_image", label: "", width: "52px",
      render: (_, row: any) => row.main_image
        ? <img src={row.main_image} alt="" className="w-9 h-9 object-cover rounded-lg border border-border" />
        : <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">—</div>,
    },
    {
      key: "product_name", label: "Product", sortable: true,
      render: (val: any, row: any) => (
        <div>
          <p className="font-medium text-sm">{val}</p>
          <p className="text-xs text-muted-foreground font-mono">{row.variants[0]?.sku || "—"}</p>
        </div>
      ),
    },
    { key: "category_name", label: "Category", sortable: true },
    { key: "brand_name", label: "Brand", sortable: true },
    {
      key: "display_price", label: "Price", sortable: true,
      render: (val: any) => <span className="font-semibold text-primary">{formatCurrency(val)}</span>,
    },
    {
      key: "total_stock", label: "Stock", sortable: true,
      render: (val: any) => (
        <span className={`font-medium ${Number(val) === 0 ? "text-destructive" : Number(val) < 10 ? "text-warning" : "text-success"}`}>
          {val}
        </span>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (val: any) => (
        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${
          val === "active" ? "bg-success/15 text-success" :
          val === "draft" ? "bg-warning/15 text-warning" :
          "bg-muted/40 text-muted-foreground"
        }`}>{val}</span>
      ),
    },
  ];

  const actions = (row: Product) => (
    <>
      <button onClick={() => handleViewDetails(row)} className="px-2 py-1 text-xs rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">View</button>
      {permissions.update && (
        <button onClick={() => handleEdit(row)} className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors">Edit</button>
      )}
      {permissions.delete && (
        <button onClick={() => handleDelete(row)} className="px-2 py-1 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors">Delete</button>
      )}
    </>
  );

  const renderCard = (product: any) => (
    <div
      onClick={() => handleViewDetails(product)}
      className="rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="h-36 bg-muted/20 overflow-hidden">
        {product.main_image
          ? <img src={product.main_image} alt={product.product_name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <div className="h-full flex items-center justify-center text-muted-foreground/30">
              <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="8" y="8" width="32" height="32" rx="4" /><path d="M8 20h32M20 8v32" />
              </svg>
            </div>
        }
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{product.product_name}</h3>
          <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
            product.status === "active" ? "bg-success/15 text-success" :
            product.status === "draft" ? "bg-warning/15 text-warning" : "bg-muted/40"
          }`}>{product.status}</span>
        </div>
        <p className="text-xs text-muted-foreground">{product.category_name}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold text-primary">{formatCurrency(product.display_price)}</span>
          <span className={`text-xs font-medium ${product.total_stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {product.total_stock} in stock
          </span>
        </div>
        {(permissions.update || permissions.delete) && (
          <div className="flex gap-2 pt-2 border-t border-border/60">
            {permissions.update && (
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                className="flex-1 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors font-medium"
              >Edit</button>
            )}
            {permissions.delete && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(product); }}
                className="flex-1 py-1.5 text-xs rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors font-medium"
              >Delete</button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        subtitle="Manage inventory, variants, and pricing"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(v => v === "table" ? "grid" : "table")}
              className="p-2 rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle view"
            >
              {viewMode === "table" ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
            {permissions.export && (
              <button
                onClick={handleExport}
                className="p-2 rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            {permissions.create && (
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Filters */}
      <ProductFilters filters={filters} onChange={setFilters} categories={categories} brands={brands} />

      {/* Table / Grid */}
      {viewMode === "table" ? (
        <TableView
          columns={columns}
          data={enrichedProducts}
          loading={isLoading}
          onRowClick={(row) => handleViewDetails(row)}
          actions={actions}
          emptyMessage="No products found. Add your first product to get started."
        />
      ) : (
        <GridView
          data={enrichedProducts}
          renderCard={renderCard}
          loading={isLoading}
          emptyMessage="No products found"
          emptyAction={permissions.create ? { label: "Add Product", onClick: handleCreate } : undefined}
          columns={4}
        />
      )}

      {/* Product Form Modal */}
      {(showProductModal && (selectedProduct ? permissions.update : permissions.create)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-card rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <ProductForm
              initialData={selectedProduct}
              onSubmit={handleSave}
              isLoading={createProduct.isPending || updateProduct.isPending}
              isEditing={!!selectedProduct}
              onCancel={() => setShowProductModal(false)}
            />
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedProduct && (
        <ProductDetailsModal
          productId={selectedProduct.id}   
          onClose={() => setShowDetailsModal(false)}
          onEdit={permissions.update ? () => { setShowDetailsModal(false); handleEdit(selectedProduct); } : undefined}
        />
      )}

      <deleteConfirm.Modal />
    </div>
  );
}