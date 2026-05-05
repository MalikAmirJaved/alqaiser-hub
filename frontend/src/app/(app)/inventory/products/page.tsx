// src/app/(app)/inventory/products/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ls } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/reuseable/DataTable";
import { Plus, Grid, List, Download, Eye, TrendingUp } from "lucide-react";
import AdvancedProductManager from "@/components/inventory/product/AdvancedProductManager";
import ProductFilters from "@/components/inventory/product/ProductFilters";
import ProductStatsCards from "@/components/inventory/product/ProductStatsCards";
import ProductDetailsModal from "@/components/inventory/product/ProductDetailsModal";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [productTags, setProductTags] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("table");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

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
    sortOrder: "asc"
  });



  // Load all related data
  const loadData = useCallback(() => {
    setProducts(ls.get<any[]>("products", []) || []);
    setCategories(ls.get<any[]>("categories", []) || []);
    setBrands(ls.get<any[]>("brands", []) || []);
    setVariants(ls.get<any[]>("productVariants", []) || []);
    setInventory(ls.get<any[]>("inventory", []) || []);
    setProductTags(ls.get<any[]>("productTags", []) || []);
    setTags(ls.get<any[]>("tags", []) || []);
    setWarehouses(ls.get<any[]>("warehouses", []) || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate stock for a product (sum across warehouses for simple products)
  const getProductStock = useCallback((productId: string, variantId: string | null = null) => {
    const inv = inventory.filter((i: any) => i.product_id === productId);
    if (variantId) {
      return inv.filter((i: any) => i.variant_id === variantId).reduce((sum, i) => sum + (i.stock_quantity || 0), 0);
    }
    // For simple products (no variants), sum stock across warehouses
    return inv.filter((i: any) => !i.variant_id).reduce((sum, i) => sum + (i.stock_quantity || 0), 0);
  }, [inventory]);

  // Get product variants
  const getProductVariants = useCallback((productId) => {
    return variants.filter(v => v.product_id === productId);
  }, [variants]);

  // Get product tags
  const getProductTags = useCallback((productId) => {
    const tagIds = productTags.filter(pt => pt.product_id === productId).map(pt => pt.tag_id);
    return tags.filter(t => tagIds.includes(t.id));
  }, [productTags, tags]);

  // Enrich products with computed data
  const enrichedProducts = useMemo<any[]>(() => {
    return products.map(product => ({
      ...product,
      stock_quantity: getProductStock(product.id),
      variants_count: getProductVariants(product.id).length,
      tags: getProductTags(product.id),
      category_name: categories.find(c => c.id === product.category_id)?.name || "—",
      brand_name: brands.find(b => b.id === product.brand_id)?.name || "—"
    }));
  }, [products, getProductStock, getProductVariants, getProductTags, categories, brands]);

  // Apply filters
  const filteredProducts = useMemo<any[]>(() => {
    let filtered = [...enrichedProducts];
    
    if (filters.category) {
      filtered = filtered.filter(p => p.category_id === filters.category);
    }
    if (filters.brand) {
      filtered = filtered.filter(p => p.brand_id === filters.brand);
    }
    if (filters.status) {
      filtered = filtered.filter(p => p.status === filters.status);
    }
    if (filters.minPrice) {
      filtered = filtered.filter(p => p.selling_price >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice) {
      filtered = filtered.filter(p => p.selling_price <= parseFloat(filters.maxPrice));
    }
    if (filters.stockStatus) {
      if (filters.stockStatus === "low") {
        filtered = filtered.filter(p => p.stock_quantity > 0 && p.stock_quantity < 10);
      } else if (filters.stockStatus === "out") {
        filtered = filtered.filter(p => p.stock_quantity === 0);
      } else if (filters.stockStatus === "in") {
        filtered = filtered.filter(p => p.stock_quantity > 0);
      }
    }
    if (filters.tags.length > 0) {
      filtered = filtered.filter(p => 
        p.tags.some(tag => filters.tags.includes(tag.id))
      );
    }
    
    return filtered;
  }, [enrichedProducts, filters]);

  const handleDelete = async (product) => {
    if (!confirm(`Delete "${product.name}" and all related data?`)) return;
    
    // Delete product
    const updatedProducts = products.filter(p => p.id !== product.id);
    ls.set("products", updatedProducts);
    
    // Delete associated variants
    const productVariantsToDelete = variants.filter(v => v.product_id === product.id);
    const updatedVariants = variants.filter(v => v.product_id !== product.id);
    ls.set("productVariants", updatedVariants);
    
    // Delete associated inventory records
    const variantIds = productVariantsToDelete.map(v => v.id);
    const updatedInventory = inventory.filter(i => 
      i.product_id !== product.id && !variantIds.includes(i.variant_id)
    );
    ls.set("inventory", updatedInventory);
    
    // Delete product-tag associations
    const updatedProductTags = productTags.filter(pt => pt.product_id !== product.id);
    ls.set("productTags", updatedProductTags);
    
    // Delete product attributes
    const productAttrs = ls.get<any[]>("productAttributes", []) || [];
    const updatedAttrs = productAttrs.filter(pa => pa.product_id !== product.id);
    ls.set("productAttributes", updatedAttrs);
    
    loadData();
  };

  const handleExport = () => {
    const exportData = filteredProducts.map(p => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category_name,
      Brand: p.brand_name,
      "Cost Price": p.cost_price,
      "Selling Price": p.selling_price,
      Stock: p.stock_quantity,
      Variants: p.variants_count,
      Tags: p.tags.map(t => t.name).join(", "),
      Status: p.status
    }));
    
    const csv = [Object.keys(exportData[0]), ...exportData.map(Object.values)]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const columns = [
    { 
      key: "sku", 
      label: "SKU", 
      render: (val) => <span className="font-mono text-xs">{val}</span>,
      sortable: true 
    },
    { 
      key: "name", 
      label: "Product Name", 
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2">
          {row.main_image && (
            <img src={row.main_image} alt="" className="w-8 h-8 rounded object-cover" />
          )}
          <div>
            <div className="font-medium">{val}</div>
            {row.variants_count > 0 && (
              <div className="text-xs text-muted-foreground">{row.variants_count} variants</div>
            )}
          </div>
        </div>
      )
    },
    { 
      key: "category_name", 
      label: "Category", 
      sortable: true 
    },
    { 
      key: "brand_name", 
      label: "Brand", 
      sortable: true 
    },
    { 
      key: "selling_price", 
      label: "Price", 
      render: (val) => (
        <div>
          <span className="font-medium">${val?.toFixed(2) || "0.00"}</span>
          {val !== val && <div className="text-xs text-muted-foreground">${val?.toFixed(2)}</div>}
        </div>
      ),
      sortable: true
    },
    { 
      key: "stock_quantity", 
      label: "Stock", 
      render: (val) => {
        let colorClass = "text-muted-foreground";
        if (val === 0) colorClass = "text-destructive font-medium";
        else if (val < 10) colorClass = "text-warning font-medium";
        else colorClass = "text-success";
        return <span className={colorClass}>{val}</span>;
      },
      sortable: true
    },
    { 
      key: "tags", 
      label: "Tags", 
      render: (val) => (
        <div className="flex flex-wrap gap-1">
          {val.slice(0, 2).map(tag => (
            <span key={tag.id} className="px-1.5 py-0.5 text-xs rounded bg-muted/40">
              {tag.name}
            </span>
          ))}
          {val.length > 2 && <span className="text-xs text-muted-foreground">+{val.length - 2}</span>}
        </div>
      )
    },
    { 
      key: "status", 
      label: "Status", 
      badge: true,
      render: (val) => (
        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
          val === "active" ? "bg-success/15 text-success" :
          val === "draft" ? "bg-warning/15 text-warning" :
          "bg-muted/40 text-muted-foreground"
        }`}>
          {val || "active"}
        </span>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader 
        title="Product Management" 
        subtitle="Manage products, variants, attributes, and inventory"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
              className="p-2 rounded-lg border border-border hover:bg-muted transition"
              title={viewMode === "table" ? "Grid View" : "Table View"}
            >
              {viewMode === "table" ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
            <button
              onClick={handleExport}
              className="p-2 rounded-lg border border-border hover:bg-muted transition"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSelectedProduct(null);
                setShowProductModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        }
      />

      <ProductStatsCards products={enrichedProducts} />

      <ProductFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        brands={brands}
        tags={tags}
      />

      <DataTable
        data={filteredProducts as any}

        columns={columns as any}
        onView={handleViewDetails}
        onEdit={(product) => {
          setSelectedProduct(product);
          setShowProductModal(true);
        }}
        onDelete={handleDelete}
        title="Products"
        searchable={true}
        searchFields={["name", "sku"] as any}
        defaultPageSize={15}
      />

      {showProductModal && (
        <AdvancedProductManager
          productId={selectedProduct?.id}
          onSave={() => {
            loadData();
            setShowProductModal(false);
          }}
          onCancel={() => setShowProductModal(false)}
        />
      )}

      {showDetailsModal && selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          variants={getProductVariants(selectedProduct.id)}
          inventory={inventory}
          attributes={ls.get<any[]>("productAttributes", []).filter((a: any) => a.product_id === selectedProduct.id)}
          tags={getProductTags(selectedProduct.id)}
          warehouses={warehouses as any}

          onClose={() => setShowDetailsModal(false)}

          onEdit={() => {
            setShowDetailsModal(false);
            setShowProductModal(true);
          }}
        />
      )}
    </div>
  );
}