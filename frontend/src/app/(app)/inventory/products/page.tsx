// src/app/(app)/inventory/products/page.tsx
"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Plus, Grid, List, Download } from "lucide-react";
import { TableView, GridView, Column } from "@/components/reuseable/TableGridView";
import ProductFilters from "@/components/inventory/product/ProductFilters";
import AdvancedProductManager from "@/components/inventory/product/AdvancedProductManager";
import ProductDetailsModal from "@/components/inventory/product/ProductDetailsModal";
import { useProducts, useDeleteProduct, useCreateProduct, useUpdateProduct, Product, ProductPayload } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useBrands } from "@/hooks/useBrands";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";

export default function ProductsPage() {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    brand: "",
    status: "",
  });

  const { data: products = [], isLoading, refetch } = useProducts(filters);
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const { data: warehouses = [] } = useWarehouses();
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteConfirm = useConfirmationModal();

  // Helper to get display price (lowest variant selling price)
  const getProductPrice = (product: Product): number => {
    if (!product.variants.length) return 0;
    const prices = product.variants.map(v => parseFloat(v.selling_price));
    return Math.min(...prices);
  };

  // Total stock across all variants
  const getTotalStock = (product: Product): number => {
    return product.variants.reduce((sum, v) => sum + v.total_stock, 0);
  };

  const enrichedProducts = useMemo(() => {
    return products.map(product => ({
      ...product,
      category_name: categories.find(c => c.id === product.category_id)?.name || "—",
      brand_name: brands.find(b => b.id === product.brand_id)?.name || "—",
      display_price: getProductPrice(product),
      total_stock: getTotalStock(product),
      // first primary image from first variant
      main_image: product.variants[0]?.variant_images.find(img => img.is_primary)?.image_url || product.variants[0]?.variant_images[0]?.image_url || "",
    }));
  }, [products, categories, brands]);

  const handleCreate = () => {
    setSelectedProduct(null);
    setShowProductModal(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const handleDelete = async (product: Product) => {
    deleteConfirm.confirm({
      title: "Delete Product",
      message: `Are you sure you want to delete "${product.product_name}"? This will also remove all variants and stock.`,
      onConfirm: async () => {
        await deleteProduct.mutateAsync(product.id);
        toast.success(`Product "${product.product_name}" deleted`);
        refetch();
      },
    });
  };

  const handleSaveProduct = async (productData: ProductPayload) => {
    if (selectedProduct) {
      await updateProduct.mutateAsync({ id: selectedProduct.id, ...productData });
      toast.success(`Product "${productData.productName}" updated`);
    } else {
      await createProduct.mutateAsync(productData);
      toast.success(`Product "${productData.productName}" created`);
    }
    setShowProductModal(false);
    refetch();
  };

  const handleExport = () => {
    const exportData = enrichedProducts.map(p => ({
      SKU: p.variants[0]?.sku || "",
      Name: p.product_name,
      Category: p.category_name,
      Brand: p.brand_name,
      Price: p.display_price,
      Stock: p.total_stock,
      Status: p.status,
    }));
    if (exportData.length === 0) return;
    const csv = [Object.keys(exportData[0]), ...exportData.map(Object.values)]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<any>[] = [
    { key: "variants", label: "SKU", render: (val: any) => <span className="font-mono text-xs">{val[0]?.sku || "—"}</span> },
    { key: "product_name", label: "Product Name", sortable: true },
    { key: "category_name", label: "Category", sortable: true },
    { key: "brand_name", label: "Brand", sortable: true },
    { key: "display_price", label: "Price", sortable: true, render: (val) => `$${val}` },
    { key: "total_stock", label: "Stock", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val:any) => (
        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
          val === "active" ? "bg-success/15 text-success" :
          val === "draft" ? "bg-warning/15 text-warning" : "bg-muted/40 text-muted-foreground"
        }`}>
          {val}
        </span>
      ),
    },
  ];

  const actions = (row: Product) => (
    <>
      <button onClick={() => handleViewDetails(row)} className="px-2 py-1 text-xs rounded-md hover:bg-muted">View</button>
      <button onClick={() => handleEdit(row)} className="px-2 py-1 text-xs rounded-md hover:bg-muted">Edit</button>
      <button onClick={() => handleDelete(row)} className="px-2 py-1 text-xs rounded-md text-destructive hover:bg-destructive/10">Delete</button>
    </>
  );

  const renderCard = (product: any) => (
    <div onClick={() => handleViewDetails(product)} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all cursor-pointer">
      {product.main_image && <img src={product.main_image} alt={product.product_name} className="h-32 w-full object-cover" />}
      <div className="p-4 space-y-2">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold">{product.product_name}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            product.status === "active" ? "bg-success/15 text-success" :
            product.status === "draft" ? "bg-warning/15 text-warning" : "bg-muted/40"
          }`}>{product.status}</span>
        </div>
        <p className="text-xs text-muted-foreground">{product.variants[0]?.sku || "—"}</p>
        <div className="flex justify-between items-center pt-2">
          <span className="text-lg font-bold text-primary">${product.display_price.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">Stock: {product.total_stock}</span>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(product); }} className="px-3 py-1 text-xs rounded-md border hover:bg-muted">Edit</button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(product); }} className="px-3 py-1 text-xs rounded-md border-destructive text-destructive hover:bg-destructive/10">Delete</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product Management"
        subtitle="Manage products, variants, attributes, and stock"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")} className="p-2 rounded-lg border border-border hover:bg-muted">
              {viewMode === "table" ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
            <button onClick={handleExport} className="p-2 rounded-lg border border-border hover:bg-muted">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={handleCreate} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground hover:opacity-90">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        }
      />

      <ProductFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        brands={brands}
      />

      {viewMode === "table" ? (
        <TableView columns={columns} data={enrichedProducts} loading={isLoading} onRowClick={(row) => handleViewDetails(row)} actions={actions} emptyMessage="No products found" />
      ) : (
        <GridView data={enrichedProducts} renderCard={renderCard} loading={isLoading} emptyMessage="No products found" emptyAction={{ label: "Add Product", onClick: handleCreate }} columns={4} />
      )}

      {showProductModal && (
        <AdvancedProductManager
          product={selectedProduct}
          categories={categories}
          brands={brands}
          onSave={handleSaveProduct}
          onCancel={() => setShowProductModal(false)}
        />
      )}

      {showDetailsModal && selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setShowDetailsModal(false)}
          onEdit={() => {
            setShowDetailsModal(false);
            handleEdit(selectedProduct);
          }}
        />
      )}

      <deleteConfirm.Modal />
    </div>
  );
}