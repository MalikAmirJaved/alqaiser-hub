// src/components/inventory/product/ProductStatsCards.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package, DollarSign, TrendingUp, AlertTriangle, Layers, Tag, ShoppingCart, Clock, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

interface ProductStatsCardsProps {
  products: any[];
  categories: any[];   // added as prop
  brands: any[];       // added as prop
}

export default function ProductStatsCards({ products, categories, brands }: ProductStatsCardsProps) {
  const [stats, setStats] = useState({
    totalProducts: 0, activeProducts: 0, draftProducts: 0, archivedProducts: 0,
    totalValue: 0, averagePrice: 0, lowStockCount: 0, outOfStockCount: 0,
    totalVariants: 0, uniqueCategories: 0, uniqueBrands: 0, totalTags: 0,
    recentlyAdded: 0, priceRange: { min: 0, max: 0 }, topCategory: "", topBrand: "",
  });

  useEffect(() => {
    calculateStats();
  }, [products, categories, brands]);

  const calculateStats = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    const activeProducts = products.filter(p => p.status === "active").length;
    const draftProducts = products.filter(p => p.status === "draft").length;
    const archivedProducts = products.filter(p => p.status === "archived").length;

    const lowStockCount = products.filter(p => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) < 10).length;
    const outOfStockCount = products.filter(p => (p.stock_quantity || 0) === 0).length;

    const totalValue = products.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.selling_price || 0)), 0);
    const avgPrice = products.filter(p => p.selling_price > 0).reduce((s, p) => s + (p.selling_price || 0), 0) / (products.filter(p => p.selling_price > 0).length || 1);
    const sellingPrices = products.map(p => p.selling_price || 0).filter(price => price > 0);
    const minPrice = sellingPrices.length ? Math.min(...sellingPrices) : 0;
    const maxPrice = sellingPrices.length ? Math.max(...sellingPrices) : 0;
    const recentlyAdded = products.filter(p => new Date(p.created_at) >= thirtyDaysAgo).length;

    const uniqueCategories = new Set(products.map(p => p.category_id).filter(Boolean)).size;
    const uniqueBrands = new Set(products.map(p => p.brand_id).filter(Boolean)).size;
    const totalVariants = products.reduce((sum, p) => sum + (p.variants?.length || 0), 0);
    const totalTags = products.reduce((sum, p) => sum + (p.tags?.length || 0), 0);

    // Find top category
    const catCount: Record<string, number> = {};
    products.forEach(p => { if (p.category_id) catCount[p.category_id] = (catCount[p.category_id] || 0) + 1; });
    const topCatId = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const topCategory = categories.find(c => c.id === topCatId)?.name || "";

    // Find top brand
    const brandCount: Record<string, number> = {};
    products.forEach(p => { if (p.brand_id) brandCount[p.brand_id] = (brandCount[p.brand_id] || 0) + 1; });
    const topBrandId = Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const topBrand = brands.find(b => b.id === topBrandId)?.name || "";

    setStats({
      totalProducts: products.length, activeProducts, draftProducts, archivedProducts,
      totalValue, averagePrice: avgPrice, lowStockCount, outOfStockCount,
      totalVariants, uniqueCategories, uniqueBrands, totalTags, recentlyAdded,
      priceRange: { min: minPrice, max: maxPrice }, topCategory, topBrand,
    });
  };

  const statsCards = [
    { title: "Total Products", value: stats.totalProducts, icon: Package, color: "bg-primary/10 text-primary", border: "border-primary/20", trend: `+${stats.recentlyAdded} this month`, trendUp: true },
    { title: "Active Products", value: stats.activeProducts, icon: ShoppingCart, color: "bg-success/10 text-success", border: "border-success/20", subtitle: `${stats.draftProducts} draft, ${stats.archivedProducts} archived` },
    { title: "Inventory Value", value: `$${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "bg-warning/10 text-warning", border: "border-warning/20", subtitle: `Avg: $${stats.averagePrice.toFixed(2)}` },
    { title: "Stock Alerts", value: stats.lowStockCount + stats.outOfStockCount, icon: AlertTriangle, color: "bg-destructive/10 text-destructive", border: "border-destructive/20", subtitle: `${stats.lowStockCount} low, ${stats.outOfStockCount} out`, alert: true },
  ];

  const secondaryStats = [
    { label: "Variants", value: stats.totalVariants, icon: Layers, description: "Total variations" },
    { label: "Categories", value: stats.uniqueCategories, icon: Package, description: stats.topCategory || "No categories" },
    { label: "Brands", value: stats.uniqueBrands, icon: Tag, description: stats.topBrand || "No brands" },
    { label: "Tags", value: stats.totalTags, icon: Tag, description: "Assigned tags" },
    { label: "Price Range", value: `$${stats.priceRange.min} - $${stats.priceRange.max}`, icon: TrendingUp, description: "Selling price" },
    { label: "Recently Added", value: stats.recentlyAdded, icon: Clock, description: "Last 30 days" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, i) => (
          <Card key={i} className={`relative overflow-hidden border-l-4 ${card.border}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{card.title}</p>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                  {card.subtitle && <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>}
                  {card.trend && <div className="flex items-center gap-1 mt-2">{card.trendUp ? <ArrowUpRight className="w-3 h-3 text-success" /> : <ArrowDownRight className="w-3 h-3 text-destructive" />}<span className={`text-xs ${card.trendUp ? "text-success" : "text-destructive"}`}>{card.trend}</span></div>}
                </div>
                <div className={`p-2 rounded-lg ${card.color}`}><card.icon className="w-5 h-5" /></div>
              </div>
              {card.alert && (stats.lowStockCount > 0 || stats.outOfStockCount > 0) && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-destructive/30">
                  <div className="h-full bg-destructive transition-all" style={{ width: `${((stats.lowStockCount + stats.outOfStockCount) / stats.totalProducts) * 100}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {secondaryStats.map((stat, i) => (
          <Card key={i} className="bg-muted/20 border-border">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1"><stat.icon className="w-3 h-3 text-muted-foreground" /><span className="text-xs font-medium uppercase">{stat.label}</span></div>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 p-3 bg-muted/10 rounded-lg border">
        <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-primary" /></div><div><p className="text-sm font-medium">Product Health</p><p className="text-xs text-muted-foreground">{stats.activeProducts} active out of {stats.totalProducts}</p></div></div>
        <div className="flex-1 max-w-md">
          <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Active</span><span>Draft</span><span>Archived</span></div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-success transition-all" style={{ width: `${(stats.activeProducts / stats.totalProducts) * 100}%` }} />
            <div className="bg-warning transition-all" style={{ width: `${(stats.draftProducts / stats.totalProducts) * 100}%` }} />
            <div className="bg-muted-foreground/30" style={{ width: `${(stats.archivedProducts / stats.totalProducts) * 100}%` }} />
          </div>
        </div>
        <div className="text-right"><p className="text-sm font-medium">{((stats.activeProducts / stats.totalProducts) * 100).toFixed(0)}% Active</p><p className="text-xs text-muted-foreground">Health score</p></div>
      </div>
    </div>
  );
}