"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, Search } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useAllVariantsSimple } from "@/hooks/useAllVariants";
import CustomerCreationModal from "@/components/sales/CustomerCreationModal";
import { useCreateQuote, useUpdateQuote, Quote } from "@/hooks/sales/useQuotes";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

interface QuoteLine {
  variant: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  variant_name?: string;
  variant_sku?: string;
}

interface QuoteFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Quote | null;
  initialCustomerId?: string | null;
  onSuccess?: (quote?: Quote) => void;  // returns created/updated quote
}

export default function QuoteFormModal({
  open,
  onClose,
  initialData,
  initialCustomerId,
  onSuccess,
}: QuoteFormModalProps) {
  const formatCurrency = useFormatCurrency();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerInfo, setNewCustomerInfo] = useState<any>(null);
  const { data: customers = [], refetch: refetchCustomers } = useCustomers("");
  const { data: variants = [] } = useAllVariantsSimple({ active_only: true });
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();

  const [formData, setFormData] = useState({
    customer: "",
    date: new Date().toISOString().split("T")[0],
    expiration_date: "",
    notes: "",
    lines: [] as QuoteLine[],
  });
  useEffect(() => {
    if (initialData) {
      setFormData({
        customer: initialData.customer || "",
        date: initialData.date || new Date().toISOString().split("T")[0],
        expiration_date: initialData.expiration_date || "",
        notes: initialData.notes || "",
        lines: (initialData.lines || []).map((line) => ({
          variant: line.variant,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount || 0,
          tax_rate: line.tax_rate || 0,
          variant_name: line.variant_name,
          variant_sku: line.variant_sku,
        })),
      });
    } else {
      resetForm();
    }
  }, [initialData, open]);
  // Pre-fill customer from lead conversion
  useEffect(() => {
    if (initialCustomerId && !initialData && open) {
      setFormData((prev) => ({
        ...prev,
        customer: initialCustomerId,
      }));
      setNewCustomerInfo(null);
    }
  }, [initialCustomerId, initialData, open]);
  const resetForm = () => {
    setFormData({
      customer: "",
      date: new Date().toISOString().split("T")[0],
      expiration_date: "",
      notes: "",
      lines: [],
    });
    setNewCustomerInfo(null);
  };

  const handleCustomerCreated = async (
    customerId: string,
    customerName: string,
    customerData: any
  ) => {
    await refetchCustomers();
    setNewCustomerInfo(customerData);
    setFormData((prev) => ({
      ...prev,
      customer: customerId,
    }));
  };

  const handleCustomerSelect = (customerId: string) => {
    setFormData((prev) => ({ ...prev, customer: customerId }));
    if (customerId) {
      setNewCustomerInfo(null);
    }
  };

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          variant: "",
          quantity: 1,
          unit_price: 0,
          discount_amount: 0,
          tax_rate: 0,
        },
      ],
    }));
  };

  const removeLine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const updateLine = (index: number, field: keyof QuoteLine, value: any) => {
    const newLines = [...formData.lines];
    if (field === "variant") {
      const variant = variants.find((v) => v.id === value);
      if (variant) {
        newLines[index] = {
          ...newLines[index],
          variant: value,
          variant_name: variant.product_name,
          variant_sku: variant.sku,
          unit_price: variant.selling_price,
        };
      } else {
        newLines[index] = { ...newLines[index], variant: value };
      }
    } else {
      newLines[index] = { ...newLines[index], [field]: value };
    }
    setFormData((prev) => ({ ...prev, lines: newLines }));
  };

  const calculateTotal = () => {
    return formData.lines.reduce((sum, line) => {
      const subtotal = line.quantity * line.unit_price;
      const discount = line.discount_amount || 0;
      const tax = (subtotal - discount) * (line.tax_rate / 100);
      return sum + (subtotal - discount + tax);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...formData };

    if (newCustomerInfo) {
      payload.new_customer = newCustomerInfo;
      delete payload.customer;
    } else if (!payload.customer) {
      delete payload.customer;
    }

    if (!payload.expiration_date) delete payload.expiration_date;
    payload.lines = payload.lines.map((line: any) => ({
      ...line,
      discount_amount: line.discount_amount || 0,
      tax_rate: line.tax_rate || 0,
    }));

    let result;
    if (initialData) {
      result = await updateQuote.mutateAsync({
        id: initialData.id,
        data: payload,
      });
    } else {
      result = await createQuote.mutateAsync(payload);
    }
    onSuccess?.(result);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border p-4 sticky top-0 bg-card z-10">
            <h2 className="text-lg font-semibold">
              {initialData ? "Edit Quote" : "New Quote"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-6">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Customer *</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      value={formData.customer}
                      onChange={handleCustomerSelect}
                      options={customers.map((c) => ({ value: c.id, label: c.name }))}
                      placeholder="Select customer"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border hover:bg-muted text-primary text-sm whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    New
                  </button>
                </div>
                {newCustomerInfo && (
                  <div className="mt-2 p-2 rounded-lg bg-success/10 border border-success/20 text-sm">
                    <p className="text-success-foreground font-medium">
                      ✓ New customer created: {newCustomerInfo.name}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quote Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expiration Date</label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, expiration_date: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium">Quote Items</label>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-right w-20">Qty</th>
                      <th className="px-3 py-2 text-right w-28">Unit Price</th>
                      <th className="px-3 py-2 text-right w-28">Discount</th>
                      <th className="px-3 py-2 text-right w-28">Tax Rate %</th>
                      <th className="px-3 py-2 text-right w-28">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lines.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          No items added
                        </td>
                      </tr>
                    ) : (
                      formData.lines.map((line, idx) => {
                        const subtotal = line.quantity * line.unit_price;
                        const discount = line.discount_amount || 0;
                        const tax = (subtotal - discount) * (line.tax_rate / 100);
                        const lineTotal = subtotal - discount + tax;
                        return (
                          <tr key={idx} className="border-t border-border">
                            <td className="px-3 py-2">
                              <SearchableSelect
                                value={line.variant}
                                onChange={(val) =>
                                  updateLine(idx, "variant", val)
                                }
                                options={variants.map((v) => ({ value: v.id, label: `${v.product_name} (${v.sku})` }))}
                                placeholder="Select variant"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) =>
                                  updateLine(idx, "quantity", parseInt(e.target.value) || 1)
                                }
                                className="w-full text-right bg-transparent focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={line.unit_price}
                                onChange={(e) =>
                                  updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)
                                }
                                className="w-full text-right bg-transparent focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={line.discount_amount}
                                onChange={(e) =>
                                  updateLine(idx, "discount_amount", parseFloat(e.target.value) || 0)
                                }
                                className="w-full text-right bg-transparent focus:outline-none"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={line.tax_rate}
                                onChange={(e) =>
                                  updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)
                                }
                                className="w-full text-right bg-transparent focus:outline-none"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(lineTotal)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLine(idx)}
                                className="text-destructive hover:bg-destructive/10 p-1 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes and Total */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Additional notes for this quote..."
                />
              </div>
              <div className="w-64 space-y-2 text-right">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>
                    {formatCurrency(
                      formData.lines.reduce(
                        (s, l) => s + l.quantity * l.unit_price,
                        0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount</span>
                  <span className="text-destructive">
                    -
                    {formatCurrency(
                      formData.lines.reduce(
                        (s, l) => s + (l.discount_amount || 0),
                        0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>
                    {formatCurrency(
                      formData.lines.reduce((s, l) => {
                        const subtotal = l.quantity * l.unit_price;
                        const discount = l.discount_amount || 0;
                        return s + (subtotal - discount) * (l.tax_rate / 100);
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createQuote.isPending || updateQuote.isPending}
                className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
              >
                {createQuote.isPending || updateQuote.isPending
                  ? "Saving..."
                  : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <CustomerCreationModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onCustomerCreated={handleCustomerCreated}
      />
    </>
  );
}