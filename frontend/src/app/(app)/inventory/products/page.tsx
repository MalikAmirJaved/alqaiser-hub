// src/app/(app)/inventory/products/page.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Plus, Grid, List, Download } from "lucide-react";
import { TableView, GridView, Column } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import ProductFilters from "@/components/inventory/product/ProductFilters";
import AdvancedProductManager from "@/components/inventory/product/AdvancedProductManager";
import ProductDetailsModal from "@/components/inventory/product/ProductDetailsModal";
import {
  useProducts,
  useProductStats,
  useDeleteProduct,
  useCreateProduct,
  useUpdateProduct,
  Product,useTags,Tag
} from "@/hooks/useProducts";
import { useCategories, Category } from "@/hooks/useCategories";
import { useBrands, Brand } from "@/hooks/useBrands";
import { useWarehouses, Warehouse } from "@/hooks/useWarehouses";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";


export default function ProductsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({
    category: "",
    brand: "",
    status: "",
    minPrice: "",
    maxPrice: "",
    stockStatus: "",
    tags: [] as string[],
    productType: "",
    sortBy: "",
    sortOrder: "asc",
  });

  // API hooks
  const { data: products = [], isLoading, refetch } = useProducts(filters);
  const { data: stats } = useProductStats();
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const { data: tags = [] } = useTags();
  const { data: warehouses = [] } = useWarehouses();
  const deleteProduct = useDeleteProduct();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const deleteConfirm = useConfirmationModal();

  // Compute stats for StatsCards component
  const statsData = stats ? [
    { id: "total", label: "Total Products", value: stats.total_products },
    { id: "active", label: "Active", value: stats.active_products, valueClassName: "text-success" },
    { id: "draft", label: "Draft", value: stats.draft_products, valueClassName: "text-warning" },
    { id: "value", label: "Inventory Value", value: `$${stats.total_inventory_value.toLocaleString()}`, valueClassName: "text-primary" },
  ] : [];

  // Prepare enriched products for display (add category_name, brand_name, stock, tags)
  const enrichedProducts = useMemo(() => {
    return products.map(product => ({
      ...product,
      category_name: categories.find(c => c.id === product.category_id)?.name || "—",
      brand_name: brands.find(b => b.id === product.brand_id)?.name || "—",
      stock_quantity: product.inventory?.reduce((sum, inv) => sum + inv.stock_quantity, 0) || 0,
      tags: product.tags || [],
    }));
  }, [products, categories, brands]);

  // Handlers
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
      message: `Are you sure you want to delete "${product.name}"? This will also remove all variants, inventory, and attributes.`,
      onConfirm: async () => {
        try {
          await deleteProduct.mutateAsync(product.id);
          toast.success(`Product "${product.name}" deleted`);
          refetch();
        } catch (error: any) {
          toast.error(error.message || "Failed to delete product");
        }
      },
    });
  };

  const handleSaveProduct = async (productData: any) => {
    try {
      if (selectedProduct) {
        await updateProduct.mutateAsync({ id: selectedProduct.id, ...productData });
        toast.success(`Product "${productData.name}" updated`);
      } else {
        await createProduct.mutateAsync(productData);
        toast.success(`Product "${productData.name}" created`);
      }
      setShowProductModal(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    }
  };

  const handleExport = () => {
    const exportData = enrichedProducts.map(p => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category_name,
      Brand: p.brand_name,
      "Cost Price": p.cost_price,
      "Selling Price": p.selling_price,
      Stock: p.stock_quantity,
      Status: p.status,
    }));
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

  // Table columns (matches TableView expectations)
const columns: Column<typeof enrichedProducts[number]>[] = [
  {
    key: "sku",
    label: "SKU",
    sortable: true,
    render: (val) => (
      <span className="font-mono text-xs">
        {String(val)}
      </span>
    ),
  },
  {
    key: "name",
    label: "Product Name",
    sortable: true,
  },
  {
    key: "category_name",
    label: "Category",
    sortable: true,
  },
  {
    key: "brand_name",
    label: "Brand",
    sortable: true,
  },
  {
    key: "selling_price",
    label: "Price",
    sortable: true,
    render: (val) => {
      const price = Number(val || 0);
      return `$${price.toFixed(2)}`;
    },
  },
  {
    key: "stock_quantity",
    label: "Stock",
    sortable: true,
    render: (val) => {
      const stock = Number(val || 0);

      return (
        <span
          className={
            stock === 0
              ? "text-destructive"
              : stock < 10
              ? "text-warning"
              : "text-success"
          }
        >
          {stock}
        </span>
      );
    },
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (val) => {
      const status = String(val);

      return (
        <span
          className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
            status === "active"
              ? "bg-success/15 text-success"
              : status === "draft"
              ? "bg-warning/15 text-warning"
              : "bg-muted/40 text-muted-foreground"
          }`}
        >
          {status}
        </span>
      );
    },
  },
];

  const actions = (row: Product) => (
    <>
      <button onClick={() => handleViewDetails(row)} className="px-2 py-1 text-xs rounded-md hover:bg-muted">
        View
      </button>
      <button onClick={() => handleEdit(row)} className="px-2 py-1 text-xs rounded-md hover:bg-muted">
        Edit
      </button>
      <button onClick={() => handleDelete(row)} className="px-2 py-1 text-xs rounded-md text-destructive hover:bg-destructive/10">
        Delete
      </button>
    </>
  );

  // Grid card renderer
  const renderCard = (product: Product) => (
    <div
      onClick={() => handleViewDetails(product)}
      className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all cursor-pointer"
    >
      {product.main_image && (
        <img src={product.main_image} alt={product.name} className="h-32 w-full object-cover" />
      )}
      <div className="p-4 space-y-2">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold">{product.name}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            product.status === "active" ? "bg-success/15 text-success" :
            product.status === "draft" ? "bg-warning/15 text-warning" : "bg-muted/40"
          }`}>
            {product.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{product.sku}</p>
        <div className="flex justify-between items-center pt-2">
          <span className="text-lg font-bold text-primary">${product.selling_price?.toFixed(2)}</span>
          <span className={`text-sm ${(product as any).stock_quantity === 0 ? "text-destructive" : "text-success"}`}>
            Stock: {(product as any).stock_quantity || 0}
          </span>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(product); }} className="px-3 py-1 text-xs rounded-md border hover:bg-muted">
            Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(product); }} className="px-3 py-1 text-xs rounded-md border-destructive text-destructive hover:bg-destructive/10">
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Product Management"
        subtitle="Manage products, variants, attributes, and inventory"
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

      {statsData.length > 0 && <StatsCards stats={statsData} />}

      <ProductFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        brands={brands}
        tags={tags}
      />

      {viewMode === "table" ? (
        <TableView
          columns={columns}
          data={enrichedProducts}
          loading={isLoading}
          onRowClick={(row) => handleViewDetails(row as Product)}
          actions={actions}
          emptyMessage="No products found"
        />
      ) : (
        <GridView
          data={enrichedProducts}
          renderCard={renderCard}
          loading={isLoading}
          emptyMessage="No products found"
          emptyAction={{ label: "Add Product", onClick: handleCreate }}
          columns={4}
        />
      )}

      {showProductModal && (
        <AdvancedProductManager
          product={selectedProduct}
          categories={categories}
          brands={brands}
          tags={tags}
          warehouses={warehouses}
          onSave={handleSaveProduct}
          onCancel={() => setShowProductModal(false)}
        />
      )}

      {showDetailsModal && selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          variants={selectedProduct.variants || []}
          inventory={selectedProduct.inventory || []}
          attributes={selectedProduct.attributes || []}
          tags={selectedProduct.tags || []}
          warehouses={warehouses}
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