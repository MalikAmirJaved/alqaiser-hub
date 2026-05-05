// src/components/inventory/product/ProductStatsCards.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Layers,
  Tag,
  ShoppingCart,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { ls } from "@/services/localStorageService";

interface ProductStatsCardsProps {
  products: any[];
}

export default function ProductStatsCards({ products }: ProductStatsCardsProps) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    draftProducts: 0,
    archivedProducts: 0,
    totalValue: 0,
    averagePrice: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalVariants: 0,
    uniqueCategories: 0,
    uniqueBrands: 0,
    totalTags: 0,
    recentlyAdded: 0,
    priceRange: { min: 0, max: 0 },
    topCategory: "",
    topBrand: "",
  });

  useEffect(() => {
    calculateStats();
  }, [products]);

  const calculateStats = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    // Basic counts
    const activeProducts = products.filter(p => p.status === "active").length;
    const draftProducts = products.filter(p => p.status === "draft").length;
    const archivedProducts = products.filter(p => p.status === "archived").length;
    
    // Stock levels
    const lowStockCount = products.filter(p => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) < 10).length;
    const outOfStockCount = products.filter(p => (p.stock_quantity || 0) === 0).length;
    
    // Financials
    const totalValue = products.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.selling_price || 0)), 0);
    const averagePrice = products.filter(p => p.selling_price > 0).reduce((sum, p) => sum + (p.selling_price || 0), 0) / (products.filter(p => p.selling_price > 0).length || 1);
    
    // Price range
    const sellingPrices = products.map(p => p.selling_price || 0).filter(price => price > 0);
    const minPrice = sellingPrices.length ? Math.min(...sellingPrices) : 0;
    const maxPrice = sellingPrices.length ? Math.max(...sellingPrices) : 0;
    
    // Recently added (last 30 days)
    const recentlyAdded = products.filter(p => {
      const createdDate = new Date(p.created_at);
      return createdDate >= thirtyDaysAgo;
    }).length;
    
    // Categories and brands
    const categories = new Set(products.map(p => p.category_id).filter(Boolean));
    const brands = new Set(products.map(p => p.brand_id).filter(Boolean));
    
    // Find top category
    const categoryCount: Record<string, number> = {};
    products.forEach(p => {
      if (p.category_id) {
        categoryCount[p.category_id] = (categoryCount[p.category_id] || 0) + 1;
      }
    });
    const topCategoryId = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    
    // Find top brand
    const brandCount: Record<string, number> = {};
    products.forEach(p => {
      if (p.brand_id) {
        brandCount[p.brand_id] = (brandCount[p.brand_id] || 0) + 1;
      }
    });
    const topBrandId = Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    
    // Get category and brand names
    const categoriesList = ls.get<any[]>("categories", []) || [];
    const brandsList = ls.get<any[]>("brands", []) || [];
    const topCategory = categoriesList.find((c: any) => c.id === topCategoryId)?.name || "";
    const topBrand = brandsList.find((b: any) => b.id === topBrandId)?.name || "";
    
    // Total variants
    const variants = ls.get<any[]>("productVariants", []) || [];
    const totalVariants = variants.filter(v => products.some(p => p.id === v.product_id)).length;
    
    // Total tags (unique tags across all products)
    const productTags = ls.get<any[]>("productTags", []) || [];
    const uniqueTagIds = new Set(productTags.map(pt => pt.tag_id));
    const totalTags = uniqueTagIds.size;
    
    setStats({
      totalProducts: products.length,
      activeProducts,
      draftProducts,
      archivedProducts,
      totalValue,
      averagePrice,
      lowStockCount,
      outOfStockCount,
      totalVariants,
      uniqueCategories: categories.size,
      uniqueBrands: brands.size,
      totalTags,
      recentlyAdded,
      priceRange: { min: minPrice, max: maxPrice },
      topCategory,
      topBrand,
    });
  };

  const statsCards = [
    {
      title: "Total Products",
      value: stats.totalProducts,
      icon: Package,
      color: "bg-primary/10 text-primary",
      border: "border-primary/20",
      trend: `+${stats.recentlyAdded} this month`,
      trendUp: true,
    },
    {
      title: "Active Products",
      value: stats.activeProducts,
      icon: ShoppingCart,
      color: "bg-success/10 text-success",
      border: "border-success/20",
      subtitle: `${stats.draftProducts} draft, ${stats.archivedProducts} archived`,
    },
    {
      title: "Total Inventory Value",
      value: `$${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "bg-warning/10 text-warning",
      border: "border-warning/20",
      subtitle: `Avg: $${stats.averagePrice.toFixed(2)}/product`,
    },
    {
      title: "Stock Alerts",
      value: stats.lowStockCount + stats.outOfStockCount,
      icon: AlertTriangle,
      color: "bg-destructive/10 text-destructive",
      border: "border-destructive/20",
      subtitle: `${stats.lowStockCount} low stock, ${stats.outOfStockCount} out of stock`,
      alert: true,
    },
  ];

  const secondaryStats = [
    {
      label: "Variants",
      value: stats.totalVariants,
      icon: Layers,
      description: "Product variations",
    },
    {
      label: "Categories",
      value: stats.uniqueCategories,
      icon: Package,
      description: stats.topCategory ? `Top: ${stats.topCategory}` : "No categories",
    },
    {
      label: "Brands",
      value: stats.uniqueBrands,
      icon: Tag,
      description: stats.topBrand ? `Top: ${stats.topBrand}` : "No brands",
    },
    {
      label: "Tags",
      value: stats.totalTags,
      icon: Tag,
      description: "Unique tags across products",
    },
    {
      label: "Price Range",
      value: `$${stats.priceRange.min} - $${stats.priceRange.max}`,
      icon: TrendingUp,
      description: stats.priceRange.max > 0 ? "Selling price range" : "No products",
    },
    {
      label: "Recently Added",
      value: stats.recentlyAdded,
      icon: Clock,
      description: "Last 30 days",
      trend: stats.recentlyAdded > 0 ? `+${stats.recentlyAdded}` : "0",
    },
  ];

  // Get trend color for value change
  const getTrendColor = (value: number) => {
    if (value > 0) return "text-success";
    if (value < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, index) => (
          <Card
            key={index}
            className={`relative overflow-hidden border-l-4 ${card.border} transition-all hover:shadow-md`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  {card.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                  )}
                  {card.trend && (
                    <div className="flex items-center gap-1 mt-2">
                      {card.trendUp ? (
                        <ArrowUpRight className="w-3 h-3 text-success" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-destructive" />
                      )}
                      <span className={`text-xs ${card.trendUp ? "text-success" : "text-destructive"}`}>
                        {card.trend}
                      </span>
                    </div>
                  )}
                </div>
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
              {card.alert && (stats.lowStockCount > 0 || stats.outOfStockCount > 0) && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-destructive/30">
                  <div
                    className="h-full bg-destructive transition-all"
                    style={{
                      width: `${((stats.lowStockCount + stats.outOfStockCount) / stats.totalProducts) * 100}%`,
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {secondaryStats.map((stat, index) => (
          <Card key={index} className="bg-muted/20 border-border">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <stat.icon className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {stat.label}
                </span>
              </div>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.description}</p>
              {stat.trend && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <ArrowUpRight className="w-2.5 h-2.5 text-success" />
                  <span className="text-xs text-success">{stat.trend}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Product Health Indicator */}
      <div className="flex items-center justify-between gap-4 p-3 bg-muted/10 rounded-lg border border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Product Health</p>
            <p className="text-xs text-muted-foreground">
              {stats.activeProducts} active out of {stats.totalProducts} products
            </p>
          </div>
        </div>
        <div className="flex-1 max-w-md">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Active</span>
            <span>Draft</span>
            <span>Archived</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div
              className="bg-success transition-all"
              style={{ width: `${(stats.activeProducts / stats.totalProducts) * 100}%` }}
            />
            <div
              className="bg-warning transition-all"
              style={{ width: `${(stats.draftProducts / stats.totalProducts) * 100}%` }}
            />
            <div
              className="bg-muted-foreground/30 transition-all"
              style={{ width: `${(stats.archivedProducts / stats.totalProducts) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">
            {((stats.activeProducts / stats.totalProducts) * 100).toFixed(0)}% Active
          </p>
          <p className="text-xs text-muted-foreground">Inventory health score</p>
        </div>
      </div>
    </div>
  );
}