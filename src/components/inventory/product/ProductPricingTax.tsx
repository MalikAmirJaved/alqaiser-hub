// src/components/inventory/product/ProductPricingTax.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Calculator, Percent } from "lucide-react";

interface ProductPricingTaxProps {
  product: any;
  onChange: (product: any) => void;
}

export default function ProductPricingTax({ product, onChange }: ProductPricingTaxProps) {
  const [profitMargin, setProfitMargin] = useState<number | null>(null);

  const updateField = (key: string, value: any) => {
    onChange({ ...product, [key]: value });
    
    // Calculate profit margin when cost or selling price changes
    if (key === "cost_price" || key === "selling_price") {
      const cost = key === "cost_price" ? value : product.cost_price;
      const selling = key === "selling_price" ? value : product.selling_price;
      if (cost > 0 && selling > 0) {
        const margin = ((selling - cost) / selling) * 100;
        setProfitMargin(Math.round(margin * 100) / 100);
      } else {
        setProfitMargin(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Core Pricing */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Base Pricing
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Cost Price <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={product.cost_price || ""}
                  onChange={(e) => updateField("cost_price", parseFloat(e.target.value) || 0)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Selling Price <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={product.selling_price || ""}
                  onChange={(e) => updateField("selling_price", parseFloat(e.target.value) || 0)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          
          {profitMargin !== null && (
            <div className={`mt-3 p-2 rounded-lg text-sm flex items-center justify-between ${
              profitMargin >= 50 ? "bg-success/10 text-success" :
              profitMargin >= 25 ? "bg-info/10 text-info" :
              profitMargin >= 10 ? "bg-warning/10 text-warning" :
              "bg-destructive/10 text-destructive"
            }`}>
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Profit Margin:
              </span>
              <span className="font-bold">{profitMargin}%</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Special Pricing */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" /> Special Pricing
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Special Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={product.special_price || ""}
                  onChange={(e) => updateField("special_price", e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Valid From</Label>
              <Input
                type="date"
                value={product.special_price_from || ""}
                onChange={(e) => updateField("special_price_from", e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Valid To</Label>
              <Input
                type="date"
                value={product.special_price_to || ""}
                onChange={(e) => updateField("special_price_to", e.target.value)}
              />
            </div>
          </div>
          
          <div className="mt-4">
            <Label className="text-sm font-medium">MSRP / List Price</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                value={product.msrp || ""}
                onChange={(e) => updateField("msrp", e.target.value ? parseFloat(e.target.value) : undefined)}
                className="pl-7"
                placeholder="Manufacturer's suggested retail price"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Configuration */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" /> Tax Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tax Class</Label>
              <Select
                value={product.tax_class || "standard"}
                onValueChange={(val) => updateField("tax_class", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tax class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Rate</SelectItem>
                  <SelectItem value="reduced">Reduced Rate</SelectItem>
                  <SelectItem value="zero">Zero Rate (Tax Exempt)</SelectItem>
                  <SelectItem value="exempt">Exempt (No Tax)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={product.tax_rate || ""}
                onChange={(e) => updateField("tax_rate", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Override default rate"
              />
              <p className="text-xs text-muted-foreground">Leave empty to use default tax rate from settings</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      {(product.cost_price > 0 || product.selling_price > 0) && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="text-sm font-medium mb-3">Pricing Summary</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost Price:</span>
                  <span>${product.cost_price?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Selling Price:</span>
                  <span className="font-medium text-success">${product.selling_price?.toFixed(2) || "0.00"}</span>
                </div>
                {product.special_price && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Special Price:</span>
                    <span className="font-medium text-warning">${product.special_price?.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Profit:</span>
                  <span className="font-medium text-success">
                    ${((product.selling_price || 0) - (product.cost_price || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Markup:</span>
                  <span>
                    {product.cost_price > 0 
                      ? `${(((product.selling_price - product.cost_price) / product.cost_price) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
                {product.tax_rate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax Amount:</span>
                    <span>${(((product.selling_price || 0) * (product.tax_rate || 0)) / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}