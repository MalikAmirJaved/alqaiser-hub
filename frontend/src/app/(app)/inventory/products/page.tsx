// src/app/(app)/inventory/products/page.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Plus, Grid, List, Download, Upload } from "lucide-react";
import { TableView, GridView, Column } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import FilterBar, { FilterField } from "@/components/reuseable/FilterBar";
import ProductForm from "@/components/inventory/product/ProductForm";
import ExportModal from "@/components/inventory/product/ExportModal";
import ImportUploadModal from "@/components/inventory/product/ImportUploadModal";
import ImportReviewModal from "@/components/inventory/product/ImportReviewModal";
import { useProducts, useDeleteProduct, useCreateProduct, useUpdateProduct, Product, ProductPayload } from "@/hooks/useProducts";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { usePagination } from "@/hooks/usePagination";
import { useServerSearch } from "@/hooks/useServerSearch";
import type { ImportRow } from "@/hooks/useProductExportImport";

export default function ProductsPage() {
  const router = useRouter();
  const formatCurrency = useFormatCurrency();
  const permissions = useFeaturePermissions("INVENTORY", "product");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportUploadModal, setShowImportUploadModal] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importSource, setImportSource] = useState<string>("excel");
  const pagination = usePagination();

  const filtersWithPage = useMemo(() => ({
    ...filters,
    page: String(pagination.page),
  }), [filters, pagination.page]);

  const { data: products = [], isLoading, totalCount } = useProducts(filtersWithPage);

  const fetchCategories = useServerSearch("/api/inventory/categories/", {
    transformOption: (c: any) => ({ value: c.id, label: c.name }),
  });

  const fetchBrands = useServerSearch("/api/inventory/brands/", {
    transformOption: (b: any) => ({ value: b.id, label: b.name }),
  });

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "category", label: "Category", type: "select", searchable: true, fetchOptions: fetchCategories },
    { name: "brand", label: "Brand", type: "select", searchable: true, fetchOptions: fetchBrands },
    { name: "status", label: "Status", type: "status", options: [
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
      { value: "archived", label: "Archived" },
      { value: "discontinued", label: "Discontinued" },
    ] },
  ];
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteConfirm = useConfirmationModal();

  const getProductPrice = (p: Product) =>
    p.variants.length ? Math.min(...p.variants.map(v => v.selling_price)) : 0;

  const getTotalStock = (p: Product) =>
    p.variants.reduce((s, v) => s + v.total_stock, 0);

  const enrichedProducts = useMemo(() =>
    products.map(p => {
      const allImages = p.variants.flatMap(v => v.variant_images);
      const primary = allImages.find(i => i.is_primary);
      const first = allImages[0];
      return {
        ...p,
        category_name: p.category_name || "—",
        brand_name: p.brand_name || "—",
        display_price: getProductPrice(p),
        total_stock: getTotalStock(p),
        main_image: primary?.image_url || first?.image_url || "",
      };
    }),
    [products]
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

  // Map selected indices to product IDs
  const selectedProductIds = useMemo(
    () => Array.from(selectedRows).map((idx) => enrichedProducts[idx]?.id).filter(Boolean),
    [selectedRows, enrichedProducts]
  );

  const handleCreate = () => { setSelectedProduct(undefined); setShowProductModal(true); };
  const handleEdit = (p: Product) => { setSelectedProduct(p); setShowProductModal(true); };
  const handleViewDetails = (p: Product) => { router.push(`/inventory/products/${p.id}`); };

  const handleDelete = (p: Product) => {
    deleteConfirm.confirm({
      title: "Delete Product",
      message: `Delete "${p.product_name}"? This removes all variants and stock.`,
      onConfirm: async () => {
        await deleteProduct.mutateAsync(p.id);
      },
    });
  };

  const handleSave = async (data: ProductPayload) => {
    if (selectedProduct) {
      await updateProduct.mutateAsync({ id: selectedProduct.id, ...data });
    } else {
      await createProduct.mutateAsync(data);
    }
    setShowProductModal(false);
  };

  // Export/Import handlers
  const handleExportOpen = () => setShowExportModal(true);
  const handleImportOpen = () => setShowImportUploadModal(true);

  const handleImportParsed = useCallback((rows: ImportRow[], source: string) => {
    setImportRows(rows);
    setImportSource(source);
    setShowImportUploadModal(false);
  }, []);

  const handleImportReviewClose = useCallback(() => {
    setImportRows([]);
    setImportSource("excel");
  }, []);

  // ── Table columns ──
  const columns: Column<any>[] = [
    {
      key: "main_image", label: "", width: "52px",
      render: (_, row: any) => row.main_image
        ? <img src={`${process.env.NEXT_PUBLIC_API_URL}${row.main_image}`} alt="" className="w-9 h-9 object-cover rounded-lg border border-border" />
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
          ? <img src={`${process.env.NEXT_PUBLIC_API_URL}${product.main_image}`} alt={product.product_name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
                onClick={handleExportOpen}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-border hover:bg-muted transition-colors text-sm font-medium"
                title="Export products"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
            {permissions.create && (
              <>
                <button
                  onClick={handleImportOpen}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-border hover:bg-muted transition-colors text-sm font-medium"
                  title="Import products"
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Filters */}
      <FilterBar fields={filterFields} filters={filters} onChange={(f) => { setFilters(f); pagination.resetPage(); }} />

      {/* Selection info bar */}
      {selectedRows.size > 0 && viewMode === "table" && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-primary/5 border border-primary/10 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{selectedRows.size}</span> product(s) selected
          </span>
          <button
            onClick={() => setSelectedRows(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table / Grid */}
      {viewMode === "table" ? (
        <TableView
          columns={columns}
          data={enrichedProducts}
          loading={isLoading}
          selectedRows={selectedRows}
          onRowSelect={setSelectedRows}
          onRowClick={(row) => handleViewDetails(row)}
          actions={actions}
          emptyMessage="No products found. Add your first product to get started."
          totalCount={totalCount}
          currentPage={pagination.page}
          onPageChange={pagination.setPage}
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
              fetchCategories={fetchCategories}
              fetchBrands={fetchBrands}
            />
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        hasSelection={selectedRows.size > 0}
        selectedProductIds={selectedProductIds}
      />

      {/* Import Upload Modal */}
      <ImportUploadModal
        open={showImportUploadModal}
        onClose={() => setShowImportUploadModal(false)}
        onParsed={handleImportParsed}
      />

      {/* Import Review Modal */}
      <ImportReviewModal
        open={importRows.length > 0}
        onClose={handleImportReviewClose}
        rows={importRows}
        source={importSource}
      />

      <deleteConfirm.Modal />
    </div>
  );
}