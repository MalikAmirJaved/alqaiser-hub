"use client";

// components/sales/QuoteFormModal.tsx
import { useEffect, useState, useRef } from "react";
import { X, Plus, Trash2, Package, Type, FileText, AlertCircle } from "lucide-react";
import { useServerSearch } from "@/hooks/useServerSearch";
import { useApi } from "@/hooks/useApi";
import type { VariantDetail } from "@/hooks/useAllVariants";
import CustomerCreationModal from "@/components/sales/CustomerCreationModal";
import { useCreateQuote, useUpdateQuote, Quote } from "@/hooks/sales/useQuotes";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { toast } from "sonner";

interface QuoteLine {
  _key: string;
  variant: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  variant_name?: string;
  variant_sku?: string;
  max_quantity?: number;
  is_manual_entry?: boolean;
  manual_variant_name?: string;
  manual_variant_sku?: string;
  description?: string;
  vendor?: string;
  vendor_name?: string;
}

let lineKeyCounter = 0;
const nextLineKey = () => `ql_${++lineKeyCounter}`;

interface QuoteFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Quote | null;
  initialCustomerId?: string | null;
  initialLeadId?: string | null;
  onSuccess?: (quote?: Quote) => void;
}

export default function QuoteFormModal({
  open,
  onClose,
  initialData,
  initialCustomerId,
  initialLeadId,
  onSuccess,
}: QuoteFormModalProps) {
  const formatCurrency = useFormatCurrency();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerInfo, setNewCustomerInfo] = useState<any>(null);
  const [customerDisplayLabel, setCustomerDisplayLabel] = useState("");

  const fetchCustomers = useServerSearch("/api/inventory/customers/", {
    transformOption: (c: any) => ({
      value: c.id,
      label: c.name,
    }),
  });

  const fetchVariants = useServerSearch("/api/inventory/variants/", {
    extraParams: { active_only: "true" },
    transformOption: (v: any) => ({
      value: v.id,
      label: `${v.product_name} (${v.sku}) — Stock: ${v.total_stock}`,
    }),
  });

  const fetchVendors = useServerSearch("/api/inventory/suppliers/", {
    transformOption: (v: any) => ({
      value: v.id,
      label: `${v.name} (${v.code})`,
    }),
  });

  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const api = useApi();

  const [formData, setFormData] = useState({
    customer: "",
    date: new Date().toISOString().split("T")[0],
    expiration_date: "",
    overall_discount_percent: 0,
    overall_tax_percent: 0,
    notes: "",
    lead: "",
    lines: [] as QuoteLine[],
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        customer: initialData.customer || "",
        date: initialData.date || new Date().toISOString().split("T")[0],
        expiration_date: initialData.expiration_date || "",
        overall_discount_percent: Number(initialData.overall_discount_percent || 0),
        overall_tax_percent: Number(initialData.overall_tax_percent || 0),
        notes: initialData.notes || "",
        lead: initialData.lead || "",
        lines: (initialData.lines || []).map((line) => ({
          _key: nextLineKey(),
          variant: line.variant,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount || 0,
          tax_rate: line.tax_rate || 0,
          variant_name: line.variant_name,
          variant_sku: line.variant_sku,
          is_manual_entry: line.is_manual_entry || false,
          manual_variant_name: line.manual_variant_name || "",
          manual_variant_sku: line.manual_variant_sku || "",
          description: line.description || "",
          vendor: line.vendor || "",
          vendor_name: line.vendor_name || "",
        })),
      });
      setCustomerDisplayLabel(initialData.customer_name || "");
    } else {
      resetForm();
    }
  }, [initialData, open]);

  useEffect(() => {
    if (initialCustomerId && !initialData && open) {
      setFormData((prev) => ({ ...prev, customer: initialCustomerId }));
      setNewCustomerInfo(null);
      api(`/api/inventory/customers/${initialCustomerId}/`)
        .then((c: any) => setCustomerDisplayLabel(c.name || ""))
        .catch(() => {});
    }
  }, [initialCustomerId, initialData, open]);

  useEffect(() => {
    if (initialLeadId && !initialData && open) {
      setFormData((prev) => ({ ...prev, lead: initialLeadId }));
    }
  }, [initialLeadId, initialData, open]);

  const resetForm = () => {
    setFormData({
      customer: "",
      date: new Date().toISOString().split("T")[0],
      expiration_date: "",
      overall_discount_percent: 0,
      overall_tax_percent: 0,
      notes: "",
      lead: "",
      lines: [],
    });
    setNewCustomerInfo(null);
    setCustomerDisplayLabel("");
  };

  const handleCustomerCreated = async (
    customerId: string,
    customerName: string,
    customerData: any
  ) => {
    setNewCustomerInfo(customerData);
    setFormData((prev) => ({ ...prev, customer: customerId }));
    setCustomerDisplayLabel(customerName);
  };

  const handleCustomerSelect = (customerId: string) => {
    setFormData((prev) => ({ ...prev, customer: customerId }));
    if (customerId) setNewCustomerInfo(null);
  };

  const addLine = () => {
    const key = nextLineKey();
    setFormData((prev) => ({
      ...prev,
      lines: [
        {
          _key: key,
          variant: "",
          quantity: 1,
          unit_price: 0,
          discount_amount: 0,
          tax_rate: 0,
          is_manual_entry: false,
          manual_variant_name: "",
          manual_variant_sku: "",
          description: "",
          vendor: "",
        },
        ...prev.lines,
      ],
    }));
  };

  const removeLine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const updateLine = async (index: number, field: keyof QuoteLine, value: any) => {
    if (field === "is_manual_entry") {
      setFormData((prev) => {
        const lines = [...prev.lines];
        lines[index] = {
          ...lines[index],
          is_manual_entry: value,
          variant: value ? "" : lines[index].variant,
          manual_variant_name: value ? lines[index].manual_variant_name : "",
          manual_variant_sku: value ? lines[index].manual_variant_sku : "",
        };
        return { ...prev, lines };
      });
    } else if (field === "variant" && value) {
      const lineKey = formData.lines[index]?._key;
      setFormData((prev) => {
        const lines = [...prev.lines];
        lines[index] = { ...lines[index], variant: value };
        return { ...prev, lines };
      });
      try {
        const variant = await api<VariantDetail>(`/api/inventory/variants/${value}/`);
        if (variant && lineKey) {
          setFormData((prev) => {
            const lines = [...prev.lines];
            const idx = lines.findIndex((l) => l._key === lineKey);
            if (idx === -1) return prev;
            const line = lines[idx] || {};
            lines[idx] = {
              ...line,
              variant: value,
              variant_name: variant.product_name,
              variant_sku: variant.sku,
              unit_price: line.unit_price || variant.selling_price,
              max_quantity: variant.total_stock,
            };
            return { ...prev, lines };
          });
        }
      } catch {}
    } else {
      setFormData((prev) => {
        const lines = [...prev.lines];
        lines[index] = { ...lines[index], [field]: value };
        return { ...prev, lines };
      });
    }
  };

  const calculateLineTotal = (line: QuoteLine) => {
    const subtotal = line.quantity * line.unit_price;
    const discount = line.discount_amount || 0;
    const tax = (subtotal - discount) * (line.tax_rate / 100);
    return subtotal - discount + tax;
  };

  const subtotal = formData.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const totalDiscount = formData.lines.reduce((s, l) => s + (l.discount_amount || 0), 0);
  const totalTax = formData.lines.reduce((s, l) => {
    const sub = l.quantity * l.unit_price;
    const disc = l.discount_amount || 0;
    return s + (sub - disc) * (l.tax_rate / 100);
  }, 0);

  const overallDiscountPercent = Number(formData.overall_discount_percent) || 0;
  const overallTaxPercent = Number(formData.overall_tax_percent) || 0;
  const overallDiscountAmount = subtotal * (overallDiscountPercent / 100);
  const totalBeforeTax = subtotal - totalDiscount - overallDiscountAmount;
  const overallTaxAmount = totalBeforeTax * (overallTaxPercent / 100);
  const calculateTotal = () => totalBeforeTax + overallTaxAmount;

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

    payload.overall_discount_percent = Number(formData.overall_discount_percent) || 0;
    payload.overall_tax_percent = Number(formData.overall_tax_percent) || 0;

    for (let i = 0; i < payload.lines.length; i++) {
      const line = payload.lines[i];
      if (line.is_manual_entry) {
        if (!line.manual_variant_name?.trim()) {
          toast.error(`Line ${i + 1}: Item name is required for manual entry.`);
          return;
        }
      } else if (!line.variant) {
        toast.error(`Line ${i + 1}: Please select a variant.`);
        return;
      }
    }

    payload.lines = payload.lines.map((line: any) => {
      const cleaned: any = {
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_amount: line.discount_amount || 0,
        tax_rate: line.tax_rate || 0,
        is_manual_entry: line.is_manual_entry || false,
      };
      if (line.is_manual_entry) {
        cleaned.manual_variant_name = line.manual_variant_name || "";
        cleaned.manual_variant_sku = line.manual_variant_sku || "";
        cleaned.description = line.description || "";
        if (line.vendor) cleaned.vendor = line.vendor;
      } else {
        cleaned.variant = line.variant;
      }
      return cleaned;
    });

    const result = initialData
      ? await updateQuote.mutateAsync({ id: initialData.id, data: payload })
      : await createQuote.mutateAsync(payload);

    onSuccess?.(result);
    onClose();
  };

  const isPending = createQuote.isPending || updateQuote.isPending;

  if (!open) return null;

  return (
    <>
      {/* ── Backdrop ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-6xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh]">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                <FileText className="w-3.5 h-3.5" />
                Quote
              </span>
              <div>
                <h2 className="text-base font-semibold leading-tight">
                  {initialData ? "Edit Quote" : "New Quote"}
                </h2>
                {initialData?.quote_number && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {initialData.quote_number}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1">
            <form onSubmit={handleSubmit} id="quote-form" className="p-6 space-y-6">

              {/* ── Section 1: Document details ── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                    Document details
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Customer */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Customer <span className="text-destructive">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          value={formData.customer}
                          onChange={handleCustomerSelect}
                          onOptionSelect={(option) => setCustomerDisplayLabel(option.label)}
                          fetchOptions={fetchCustomers}
                          placeholder="Search customers…"
                          required={!newCustomerInfo}
                          displayLabel={customerDisplayLabel}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCustomerModal(true)}
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-primary transition-colors shrink-0"
                        title="Create new customer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {newCustomerInfo && (
                      <div className="flex items-center gap-2 mt-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-xs">
                        <span className="text-success font-medium">✓ New: {newCustomerInfo.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewCustomerInfo(null);
                            setFormData((prev) => ({ ...prev, customer: "" }));
                          }}
                          className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quote date */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Quote date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, date: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Expiry date */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">
                      Expires on
                      <span className="ml-1 text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, expiration_date: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </section>

              {/* ── Divider ── */}
              <hr className="border-border" />

              {/* ── Section 2: Line items ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                      Line items
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add item
                  </button>
                </div>

                {/* Empty state */}
                {formData.lines.length === 0 ? (
                  <button
                    type="button"
                    onClick={addLine}
                    className="w-full py-10 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors group flex flex-col items-center gap-2 text-muted-foreground"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Plus className="w-5 h-5 group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                      Add your first item
                    </span>
                    <span className="text-xs">Click to add a product or service</span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-border overflow-visible">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b-2 border-border/60">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                            Product / Service
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-24">
                            Qty
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-32">
                            Unit price
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-28">
                            Discount
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-24">
                            Tax %
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-28">
                            Total
                          </th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {formData.lines.map((line, idx) => {
                          const lineTotal = calculateLineTotal(line);
                          return (
                            <tr key={line._key} className="group hover:bg-muted/20 transition-colors">
                              {/* ── Item cell ── */}
                              <td className="px-4 py-3 min-w-[280px] align-bottom">
                                {/* Entry-mode toggle */}
                                <div className="inline-flex rounded-md border border-border overflow-hidden mb-2 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => updateLine(idx, "is_manual_entry", false)}
                                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                                      !line.is_manual_entry
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    <Package className="w-3 h-3" />
                                    Inventory
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateLine(idx, "is_manual_entry", true)}
                                    className={`flex items-center gap-1 px-2.5 py-1 border-l border-border transition-colors ${
                                      line.is_manual_entry
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    <Type className="w-3 h-3" />
                                    Manual
                                  </button>
                                </div>

                                {!line.is_manual_entry ? (
                                  <SearchableSelect
                                    value={line.variant}
                                    onChange={(val) => updateLine(idx, "variant", val)}
                                    fetchOptions={fetchVariants}
                                    placeholder="Search variants…"
                                  />
                                ) : (
                                  <div className="space-y-1.5">
                                    <input
                                      type="text"
                                      value={line.manual_variant_name || ""}
                                      onChange={(e) =>
                                        updateLine(idx, "manual_variant_name", e.target.value)
                                      }
                                      className="w-full h-8 bg-muted/40 border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                      placeholder="Item name…"
                                    />
                                    <div className="flex gap-1.5">
                                      <input
                                        type="text"
                                        value={line.manual_variant_sku || ""}
                                        onChange={(e) =>
                                          updateLine(idx, "manual_variant_sku", e.target.value)
                                        }
                                        className="flex-1 h-8 bg-muted/40 border border-border rounded-md px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="SKU (optional)"
                                      />
                                      <div className="flex-1">
                                        <SearchableSelect
                                          value={line.vendor || ""}
                                          onChange={(val) => updateLine(idx, "vendor", val)}
                                          fetchOptions={fetchVendors}
                                          placeholder="Vendor…"
                                        />
                                      </div>
                                    </div>
                                    <input
                                      type="text"
                                      value={line.description || ""}
                                      onChange={(e) =>
                                        updateLine(idx, "description", e.target.value)
                                      }
                                      className="w-full h-8 bg-muted/40 border border-border rounded-md px-3 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                      placeholder="Description / notes for this line…"
                                    />
                                  </div>
                                )}
                              </td>

                              {/* ── Qty ── */}
                              <td className="px-3 py-3 align-bottom">
                                <input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    updateLine(idx, "quantity", val > 0 ? val : 1);
                                  }}
                                  className="w-full h-8 px-2 bg-background border border-input hover:border-amber-400/60 focus:border-amber-500 rounded-md text-right text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                />
                              </td>

                              {/* ── Unit price ── */}
                              <td className="px-3 py-3 align-bottom">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.unit_price}
                                  onChange={(e) =>
                                    updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full h-8 px-2 bg-background border border-input hover:border-amber-400/60 focus:border-amber-500 rounded-md text-right text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                  placeholder="0.00"
                                />
                              </td>

                              {/* ── Discount ── */}
                              <td className="px-3 py-3 align-bottom">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.discount_amount}
                                  onChange={(e) =>
                                    updateLine(
                                      idx,
                                      "discount_amount",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full h-8 px-2 bg-background border border-input hover:border-amber-400/60 focus:border-amber-500 rounded-md text-right text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-destructive placeholder:text-destructive/50"
                                  placeholder="0.00"
                                />
                              </td>

                              {/* ── Tax ── */}
                              <td className="px-3 py-3 align-bottom">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.tax_rate}
                                  onChange={(e) =>
                                    updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full h-8 px-2 bg-background border border-input hover:border-amber-400/60 focus:border-amber-500 rounded-md text-right text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                  placeholder="0"
                                />
                              </td>

                              {/* ── Line total ── */}
                              <td className="px-3 py-3 text-right font-medium text-sm align-bottom">
                                {formatCurrency(lineTotal)}
                              </td>

                              {/* ── Delete ── */}
                              <td className="px-2 py-3 text-center align-bottom">
                                <button
                                  type="button"
                                  onClick={() => removeLine(idx)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                  aria-label="Remove line"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Inline "add row" footer */}
                    <button
                      type="button"
                      onClick={addLine}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-amber-600 dark:text-amber-500 hover:bg-amber-500/5 border-t border-border transition-colors rounded-b-xl"
                    >
                      <Plus className="w-4 h-4" />
                      Add another item
                    </button>
                  </div>
                )}
              </section>

              {/* ── Section 3: Notes + Totals ── */}
              <div className="flex flex-col md:flex-row gap-6 pt-1">
                {/* Notes */}
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">
                    Notes
                    <span className="ml-1 text-xs font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Add any notes or terms visible on the quote…"
                  />
                </div>

                {/* Totals summary */}
                <div className="md:w-[340px] shrink-0">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>

                    {/* Overall discount % */}
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">Discount</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.overall_discount_percent}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              overall_discount_percent: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-14 h-6 text-xs text-right bg-muted/40 border border-border rounded px-1 focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                      <span className="font-mono text-sm text-destructive">
                        −{formatCurrency(overallDiscountAmount)}
                      </span>
                    </div>

                    {/* Overall tax % */}
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">Tax</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.overall_tax_percent}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              overall_tax_percent: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-14 h-6 text-xs text-right bg-muted/40 border border-border rounded px-1 focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                      <span className="font-mono text-sm">
                        {formatCurrency(overallTaxAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-border">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-lg font-bold font-mono">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* ── Sticky footer ── */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/30 shrink-0 rounded-b-2xl">
            <p className="text-xs text-muted-foreground">
              {formData.lines.length === 0
                ? "No items added yet"
                : `${formData.lines.length} item${formData.lines.length !== 1 ? "s" : ""} · Total ${formatCurrency(calculateTotal())}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-9 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="quote-form"
                disabled={isPending}
                className="px-5 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Saving…" : initialData ? "Update quote" : "Save quote"}
              </button>
            </div>
          </div>
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