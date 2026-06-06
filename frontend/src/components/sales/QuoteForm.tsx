"use client";

import { useState, useEffect } from "react";
import { useAllVariantsSimple } from "@/hooks/useAllVariants";
import { useCustomers } from "@/hooks/useCustomers";
import { Quote, QuoteLine } from "@/hooks/sales/useQuotes";
import { Plus, Trash2, Search, UserPlus, Calendar, FileText, Boxes, X } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import CustomerForm from "@/components/inventory/customers/CustomerForm";

interface QuoteFormProps {
  initialData?: Partial<Quote>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function QuoteForm({ initialData, onSubmit, onCancel, isLoading }: QuoteFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<any>(null);

  const [formData, setFormData] = useState({
    customer: initialData?.customer || "",
    date: initialData?.date || new Date().toISOString().split('T')[0],
    expiration_date: initialData?.expiration_date || "",
    notes: initialData?.notes || "",
    lines: (initialData?.lines || []).map(line => ({
      ...line,
      discount_amount: line.discount_amount || 0,
      tax_rate: line.tax_rate || 0,
    })) as QuoteLine[],
  });

  const { data: customers = [] } = useCustomers("");
  const { data: variants = [] } = useAllVariantsSimple({ active_only: true });

  const handleLineChange = (index: number, field: keyof QuoteLine, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    if (field === 'variant') {
      const variant = variants.find(v => v.id === value);
      if (variant) {
        newLines[index].unit_price = variant.selling_price;
        newLines[index].variant_name = variant.product_name;
        newLines[index].variant_sku = variant.sku;
      }
    }
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { variant: "", quantity: 1, unit_price: 0, tax_rate: 0, discount_amount: 0 }],
    });
  };

  const removeLine = (index: number) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index),
    });
  };

  const calculateSubtotal = () => {
    return formData.lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0);
  };

  const calculateTotal = () => {
    return formData.lines.reduce((sum, line) => {
      const lineSubtotal = line.quantity * line.unit_price;
      const discount = Number(line.discount_amount || 0);
      const tax = lineSubtotal * (Number(line.tax_rate || 0) / 100);
      return sum + (lineSubtotal - discount + tax);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare payload
    const payload: any = { ...formData };

    // Clean customer fields
    if (newCustomerData) {
      delete payload.customer;
    } else if (!payload.customer) {
      delete payload.customer;
    }

    // Normalize line items
    payload.lines = payload.lines.map((line: any) => ({
      ...line,
      discount_amount: line.discount_amount || 0,
      tax_rate: line.tax_rate || 0,
    }));

    // Add new_customer if present
    if (newCustomerData) {
      payload.new_customer = newCustomerData;
    }

    // Remove expiration_date if empty
    if (!payload.expiration_date) delete payload.expiration_date;

    await onSubmit(payload);
  };

  const handleInlineCustomerSubmit = async (data: any) => {
    setNewCustomerData(data);
    setShowCustomerForm(false);
    setFormData({ ...formData, customer: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> General Information
          </h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1">
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Customer
            </label>
            <div className="flex gap-2">
              <select
                value={formData.customer}
                onChange={(e) => {
                  setFormData({ ...formData, customer: e.target.value });
                  setNewCustomerData(null);
                }}
                disabled={!!newCustomerData}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
                required={!newCustomerData}
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCustomerForm(true)}
                className="p-2 rounded-lg border border-border hover:bg-muted text-primary transition"
                title="Add New Customer"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
            {newCustomerData && (
              <div className="mt-2 p-2 rounded-md bg-success/10 border border-success/20 text-xs text-success flex items-center justify-between">
                <span>New: {newCustomerData.name}</span>
                <button type="button" onClick={() => setNewCustomerData(null)} className="font-bold hover:underline">
                  Clear
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Quote Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Expiration Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Boxes className="w-4 h-4 text-primary" /> Quote Items
          </h3>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                  Product / Variant
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase tracking-wider text-[10px] w-24">
                  Qty
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase tracking-wider text-[10px] w-32">
                  Unit Price
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase tracking-wider text-[10px] w-32">
                  Discount
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase tracking-wider text-[10px] w-32">
                  Total
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {formData.lines.map((line, index) => {
                const lineTotal = (line.quantity * line.unit_price) - (Number(line.discount_amount) || 0);
                return (
                  <tr key={index} className="hover:bg-muted/10 transition">
                    <td className="px-4 py-2">
                      <select
                        value={line.variant}
                        onChange={(e) => handleLineChange(index, 'variant', e.target.value)}
                        className="w-full bg-transparent focus:outline-none border-none p-0 appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Select a variant...</option>
                        {variants.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.product_name} ({v.sku})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(index, 'quantity', parseInt(e.target.value))}
                        className="w-full text-right bg-transparent focus:outline-none p-0 border-none"
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => handleLineChange(index, 'unit_price', parseFloat(e.target.value))}
                        className="w-full text-right bg-transparent focus:outline-none p-0 border-none"
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={line.discount_amount}
                        onChange={(e) => handleLineChange(index, 'discount_amount', parseFloat(e.target.value))}
                        className="w-full text-right bg-transparent focus:outline-none p-0 border-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-primary">
                      {formatCurrency(lineTotal)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => removeLine(index)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {formData.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="w-8 h-8 opacity-20" />
                      <p className="text-xs">No items added yet. Click "Add Item" to start building your quote.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-muted/10 border-t border-border flex flex-col md:flex-row justify-between gap-6">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Internal Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
              placeholder="Add terms, conditions or internal remarks..."
            />
          </div>
          <div className="w-full md:w-64 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-medium text-destructive">
                -{formatCurrency(formData.lines.reduce((sum, l) => sum + Number(l.discount_amount || 0), 0))}
              </span>
            </div>
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <span className="text-base font-bold">Total</span>
              <span className="text-xl font-black text-primary">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl border border-border font-medium hover:bg-muted transition">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || formData.lines.length === 0}
          className="px-8 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition"
        >
          {isLoading ? "Saving..." : initialData?.id ? "Update Quote" : "Create Quote"}
        </button>
      </div>

      {/* Inline Customer Modal */}
      {showCustomerForm && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Create New Customer</h2>
              <button onClick={() => setShowCustomerForm(false)} className="p-1 hover:bg-muted rounded-md transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <CustomerForm
              onSubmit={handleInlineCustomerSubmit}
              onCancel={() => setShowCustomerForm(false)}
            />
          </div>
        </div>
      )}
    </form>
  );
}