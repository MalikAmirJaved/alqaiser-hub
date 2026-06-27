// components/finance/CustomerInvoiceFormModal.tsx
import { useEffect, useState, useCallback, memo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { X, Plus, Trash2, RotateCw, Package, Type, FileText, AlertCircle, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCustomerInvoice,
  useUpdateCustomerInvoice,
  type CustomerInvoice,
} from "@/hooks/finance/useCustomerInvoices";
import { useCreateSalesInvoice, useUpdateSalesInvoice } from "@/hooks/sales/useSalesInvoices";
import { useServerSearch } from "@/hooks/useServerSearch";
import { useApi } from "@/hooks/useApi";
import type { VariantDetail } from "@/hooks/useAllVariants";
import CustomerCreationModal from "@/components/sales/CustomerCreationModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useAutoCode } from "@/hooks/useAutoCode";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { toast } from "sonner";

interface InvoiceLine {
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
  vendor?: string;
  vendor_name?: string;
  cost_price?: number;
}

interface CustomerInvoiceFormData {
  invoice_number: string;
  customer: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  notes: string;
  lines: InvoiceLine[];
  new_customer?: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: CustomerInvoice | null;
  defaultValues?: Partial<CustomerInvoiceFormData> | null;
  onSuccess?: (result?: any) => void;
  moduleCode?: "FINANCE" | "SALES";
}

// ─────────────────────────────────────────────────────────────────────────────
// ManualEntryFields — isolated so typing never loses focus.
// Keeps its own local state and only flushes to the parent on blur,
// which means the parent's useFieldArray update() never re-mounts these inputs.
// ─────────────────────────────────────────────────────────────────────────────

interface ManualEntryFieldsProps {
  name: string;
  sku: string;
  costPrice: number | undefined;
  vendorValue: string;
  fetchVendors: any;
  onNameBlur: (val: string) => void;
  onSkuBlur: (val: string) => void;
  onCostPriceBlur: (val: number | undefined) => void;
  onVendorChange: (val: string) => void;
}

const ManualEntryFields = memo(function ManualEntryFields({
  name,
  sku,
  costPrice,
  vendorValue,
  fetchVendors,
  onNameBlur,
  onSkuBlur,
  onCostPriceBlur,
  onVendorChange,
}: ManualEntryFieldsProps) {
  const [localName, setLocalName] = useState(name);
  const [localSku, setLocalSku] = useState(sku);
  const [localCostPrice, setLocalCostPrice] = useState(
    costPrice !== undefined ? String(costPrice) : ""
  );

  // Sync if parent resets (modal re-open / edit load)
  useEffect(() => { setLocalName(name); }, [name]);
  useEffect(() => { setLocalSku(sku); }, [sku]);
  useEffect(() => {
    setLocalCostPrice(costPrice !== undefined ? String(costPrice) : "");
  }, [costPrice]);

  return (
    <div className="space-y-1.5">
      {/* Item name — onChange only updates local state; parent gets value on blur */}
      <input
        type="text"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={() => onNameBlur(localName)}
        className="w-full h-8 bg-muted/40 border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Item name…"
      />

      {/* SKU + Vendor */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={localSku}
          onChange={(e) => setLocalSku(e.target.value)}
          onBlur={() => onSkuBlur(localSku)}
          className="flex-1 h-8 bg-muted/40 border border-border rounded-md px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="SKU (optional)"
        />
        <div className="flex-1">
          <SearchableSelect
            value={vendorValue}
            onChange={onVendorChange}
            fetchOptions={fetchVendors}
            placeholder="Vendor…"
          />
        </div>
      </div>

      {/* Cost price */}
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] text-muted-foreground whitespace-nowrap">
          Cost price:
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={localCostPrice}
          onChange={(e) => setLocalCostPrice(e.target.value)}
          onBlur={() =>
            onCostPriceBlur(localCostPrice !== "" ? parseFloat(localCostPrice) : undefined)
          }
          className="w-28 h-7 bg-muted/40 border border-border rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="0.00"
        />
      </div>
    </div>
  );
});

export default function CustomerInvoiceFormModal({
  open,
  onClose,
  initialData,
  defaultValues,
  onSuccess,
  moduleCode = "FINANCE",
}: Props) {
  const formatCurrency = useFormatCurrency();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerInfo, setNewCustomerInfo] = useState<any>(null);
  const [customerDisplayLabel, setCustomerDisplayLabel] = useState("");
  const [variantDisplayLabels, setVariantDisplayLabels] = useState<Record<number, string>>({});

  const fetchCustomers = useServerSearch("/api/inventory/customers/", {
    transformOption: (c: any) => ({
      value: c.id,
      label: `${c.name} (${c.customer_code || ""})`,
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

  const createInvoice = useCreateCustomerInvoice();
  const updateInvoice = useUpdateCustomerInvoice();
  const createSalesInvoice = useCreateSalesInvoice();
  const updateSalesInvoice = useUpdateSalesInvoice();
  const queryClient = useQueryClient();
  const api = useApi();
  const { generateCode, validateCode } = useAutoCode("customer_invoice");

  const { register, control, handleSubmit, reset, setValue, watch } =
    useForm<CustomerInvoiceFormData>({
      defaultValues: {
        invoice_number: "",
        customer: "",
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: "",
        amount: 0,
        notes: "",
        lines: [],
      },
    });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "lines",
  });

  const watchedLines = watch("lines");

  const calculateLineTotal = (line: InvoiceLine) => {
    const subtotal = line.quantity * line.unit_price;
    const discount = line.discount_amount || 0;
    const tax = (subtotal - discount) * (line.tax_rate / 100);
    return subtotal - discount + tax;
  };

  const calculateOverallTotal = () =>
    (watchedLines || []).reduce((sum, line) => sum + calculateLineTotal(line), 0);

  const subtotal = (watchedLines || []).reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const totalDiscount = (watchedLines || []).reduce((s, l) => s + (l.discount_amount || 0), 0);
  const totalTax = (watchedLines || []).reduce((s, l) => {
    const sub = l.quantity * l.unit_price;
    const disc = l.discount_amount || 0;
    return s + (sub - disc) * (l.tax_rate / 100);
  }, 0);

  useEffect(() => {
    setValue("amount", calculateOverallTotal());
  }, [watchedLines, setValue]);

  useEffect(() => {
    if (initialData) {
      setValue("invoice_number", initialData.invoice_number);
      setValue("customer", initialData.customer);
      setValue("invoice_date", initialData.invoice_date);
      setValue("due_date", initialData.due_date);
      setValue(
        "amount",
        typeof initialData.amount === "string"
          ? parseFloat(initialData.amount)
          : initialData.amount
      );
      setValue("notes", initialData.notes);
      setValue(
        "lines",
        (initialData.lines || []).map((line: any) => ({
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
          vendor: line.vendor || "",
          vendor_name: line.vendor_name || "",
          cost_price: line.cost_price || undefined,
        }))
      );
      setCustomerDisplayLabel((initialData as any).customer_name || "");
      const labels: Record<number, string> = {};
      (initialData.lines || []).forEach((line: any, idx: number) => {
        if (line.variant_name || line.variant_sku) {
          labels[idx] = line.variant_name || line.variant_sku || "";
        }
      });
      setVariantDisplayLabels(labels);
      setNewCustomerInfo(null);
    } else if (defaultValues) {
      if (defaultValues.invoice_number !== undefined) setValue("invoice_number", defaultValues.invoice_number);
      if (defaultValues.customer !== undefined) setValue("customer", defaultValues.customer);
      if (defaultValues.invoice_date !== undefined) setValue("invoice_date", defaultValues.invoice_date);
      if (defaultValues.due_date !== undefined) setValue("due_date", defaultValues.due_date);
      if (defaultValues.amount !== undefined) setValue("amount", defaultValues.amount);
      if (defaultValues.notes !== undefined) setValue("notes", defaultValues.notes);
      if (defaultValues.lines !== undefined) setValue("lines", defaultValues.lines as any);
      setCustomerDisplayLabel((defaultValues as any).customer_name || "");
      const labels: Record<number, string> = {};
      ((defaultValues as any).lines || []).forEach((line: any, idx: number) => {
        if (line.variant_name || line.variant_sku) {
          labels[idx] = line.variant_name || line.variant_sku || "";
        }
      });
      setVariantDisplayLabels(labels);
    } else {
      reset({
        invoice_number: "",
        customer: "",
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: "",
        amount: 0,
        notes: "",
        lines: [],
      });
      setCustomerDisplayLabel("");
      setVariantDisplayLabels({});
      setNewCustomerInfo(null);
      generateCode()
        .then((code) => setValue("invoice_number", code))
        .catch(() => {});
    }
  }, [initialData, defaultValues, setValue, reset, open]);

  const handleCustomerCreated = async (
    customerId: string,
    customerName: string,
    customerData: any
  ) => {
    setNewCustomerInfo(customerData);
    setValue("customer", customerId);
  };

  const addLine = () => {
    append({
      variant: "",
      quantity: 1,
      unit_price: 0,
      discount_amount: 0,
      tax_rate: 0,
      is_manual_entry: false,
      manual_variant_name: "",
      manual_variant_sku: "",
      vendor: "",
      cost_price: undefined,
    });
  };

  const updateLine = useCallback(
    async (index: number, field: keyof InvoiceLine, value: any) => {
      const currentLines = watch("lines");
      if (field === "is_manual_entry") {
        update(index, {
          ...currentLines[index],
          is_manual_entry: value,
          variant: value ? "" : currentLines[index].variant,
          manual_variant_name: value ? currentLines[index].manual_variant_name : "",
          manual_variant_sku: value ? currentLines[index].manual_variant_sku : "",
        });
      } else if (field === "variant" && value) {
        update(index, { ...currentLines[index], variant: value });
        try {
          const variant = await api<VariantDetail>(`/api/inventory/variants/${value}/`);
          if (variant) {
            update(index, {
              ...currentLines[index],
              variant: value,
              variant_name: variant.product_name,
              variant_sku: variant.sku,
              unit_price: variant.selling_price,
              max_quantity: variant.total_stock,
            });
          }
        } catch {}
      } else {
        update(index, { ...currentLines[index], [field]: value });
      }
    },
    [api, update, watch]
  );

  const onSubmit = async (data: CustomerInvoiceFormData) => {
    // ── Manual entry validation ──
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      if (line.is_manual_entry) {
        if (!line.manual_variant_name?.trim()) {
          toast.error(`Line ${i + 1}: Item name is required for manual entry.`);
          return;
        }
        if (!line.vendor?.trim()) {
          toast.error(`Line ${i + 1}: Vendor is required for manual entry items.`);
          return;
        }
        if (line.cost_price === undefined || line.cost_price === null || line.cost_price < 0) {
          toast.error(`Line ${i + 1}: Cost price is required for manual entry items.`);
          return;
        }
      }
    }

    // ── Stock validation (only for non-manual entries) ──
    for (const line of data.lines) {
      if (
        !line.is_manual_entry &&
        line.variant &&
        line.max_quantity !== undefined &&
        line.quantity > line.max_quantity
      ) {
        const name = line.variant_name || line.variant_sku || line.variant;
        toast.error(
          `Insufficient stock for "${name}". Requested ${line.quantity}, only ${line.max_quantity} available.`
        );
        return;
      }
    }

    const payload: any = { ...data };
    payload.amount =
      typeof payload.amount === "number" ? payload.amount : parseFloat(payload.amount);
    if (newCustomerInfo) {
      payload.new_customer = newCustomerInfo;
      delete payload.customer;
    } else if (!payload.customer) {
      delete payload.customer;
    }
    if (!payload.due_date) payload.due_date = null;

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
        if (line.vendor) cleaned.vendor = line.vendor;
        if (line.cost_price !== undefined && line.cost_price !== null)
          cleaned.cost_price = line.cost_price;
      } else {
        cleaned.variant = line.variant;
      }
      return cleaned;
    });

    let result: any;
    if (moduleCode === "SALES") {
      result = initialData?.id
        ? await updateSalesInvoice.mutateAsync({ id: initialData.id, data: payload })
        : await createSalesInvoice.mutateAsync(payload);
    } else {
      result = initialData?.id
        ? await updateInvoice.mutateAsync({ id: initialData.id, data: payload })
        : await createInvoice.mutateAsync(payload);
    }
    onSuccess?.(result);
    onClose();
  };

  const isPending =
    createInvoice.isPending ||
    updateInvoice.isPending ||
    createSalesInvoice.isPending ||
    updateSalesInvoice.isPending;

  if (!open) return null;

  return (
    <>
      {/* ── Backdrop ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh]">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              {/* Doc-type badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                <FileText className="w-3.5 h-3.5" />
                Invoice
              </span>
              <div>
                <h2 className="text-base font-semibold leading-tight">
                  {initialData?.id ? "Edit Invoice" : "New Customer Invoice"}
                </h2>
                {initialData?.invoice_number && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {initialData.invoice_number}
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
            <form onSubmit={handleSubmit(onSubmit)} id="invoice-form" className="p-6 space-y-6">

              {/* ── Section 1: Document details ── */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Document details
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Invoice number */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Invoice number <span className="text-destructive">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        {...register("invoice_number", { required: true })}
                        onBlur={(e) => validateCode(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. INV-2025-001"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          generateCode()
                            .then((code) => setValue("invoice_number", code))
                            .catch(() => {})
                        }
                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors shrink-0"
                        title="Auto-generate number"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Invoice date */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Invoice date</label>
                    <input
                      type="date"
                      {...register("invoice_date")}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Due date */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">
                      Due date
                      <span className="ml-1 text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      type="date"
                      {...register("due_date")}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </section>

              {/* ── Divider ── */}
              <hr className="border-border" />

              {/* ── Section 2: Customer ── */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Customer
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Bill to <span className="text-destructive">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          value={watch("customer") || ""}
                          onChange={(val) => setValue("customer", val)}
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

                    {/* New customer confirmation chip */}
                    {newCustomerInfo && (
                      <div className="flex items-center gap-2 mt-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-xs">
                        <span className="text-success font-medium">✓ New: {newCustomerInfo.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewCustomerInfo(null);
                            setValue("customer", "");
                          }}
                          className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ── Divider ── */}
              <hr className="border-border" />

              {/* ── Section 3: Line items ── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Line items
                  </p>
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
                {fields.length === 0 ? (
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
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                            Product / Service
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-20">
                            Qty
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-28">
                            Unit price
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-24">
                            Discount
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-20">
                            Tax %
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-28">
                            Total
                          </th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {fields.map((field, idx) => {
                          const currentLine = watchedLines?.[idx] || {
                            quantity: 1,
                            unit_price: 0,
                            discount_amount: 0,
                            tax_rate: 0,
                            is_manual_entry: false,
                          };
                          const lineTotal = calculateLineTotal(currentLine);
                          const isOverStock =
                            !currentLine.is_manual_entry &&
                            currentLine.max_quantity !== undefined &&
                            currentLine.quantity > currentLine.max_quantity;

                          return (
                            <tr key={field.id} className="group hover:bg-muted/20 transition-colors">
                              {/* ── Item cell ── */}
                              <td className="px-4 py-3 min-w-[300px] align-top">
                                {/* Entry-mode toggle */}
                                <div className="inline-flex rounded-md border border-border overflow-hidden mb-2 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => updateLine(idx, "is_manual_entry", false)}
                                    className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                                      !currentLine.is_manual_entry
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
                                      currentLine.is_manual_entry
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    <Type className="w-3 h-3" />
                                    Manual
                                  </button>
                                </div>

                                {!currentLine.is_manual_entry ? (
                                  <SearchableSelect
                                    value={currentLine.variant || ""}
                                    onChange={(val) => updateLine(idx, "variant", val)}
                                    fetchOptions={fetchVariants}
                                    placeholder="Search variants…"
                                    displayLabel={variantDisplayLabels[idx] || ""}
                                  />
                                ) : (
                                  /* Isolated component — typing here never re-mounts the input */
                                  <ManualEntryFields
                                    key={`manual-${field.id}`}
                                    name={currentLine.manual_variant_name || ""}
                                    sku={currentLine.manual_variant_sku || ""}
                                    costPrice={currentLine.cost_price}
                                    vendorValue={currentLine.vendor || ""}
                                    fetchVendors={fetchVendors}
                                    onNameBlur={(val) => updateLine(idx, "manual_variant_name", val)}
                                    onSkuBlur={(val) => updateLine(idx, "manual_variant_sku", val)}
                                    onCostPriceBlur={(val) => updateLine(idx, "cost_price", val)}
                                    onVendorChange={(val) => updateLine(idx, "vendor", val)}
                                  />
                                )}
                              </td>

                              {/* ── Qty ── */}
                              <td className="px-3 py-3 align-top">
                                <div className="flex flex-col items-end gap-0.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max={currentLine.max_quantity || 999999}
                                    value={currentLine.quantity}
                                    onChange={(e) => {
                                      let val = parseInt(e.target.value) || 1;
                                      if (val < 1) val = 1;
                                      if (!currentLine.is_manual_entry) {
                                        const max = currentLine.max_quantity;
                                        if (max !== undefined && val > max) val = max;
                                      }
                                      updateLine(idx, "quantity", val);
                                    }}
                                    className={`w-full text-right bg-transparent focus:outline-none text-sm ${
                                      isOverStock ? "text-destructive font-medium" : ""
                                    }`}
                                  />
                                  {isOverStock && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-destructive whitespace-nowrap">
                                      <AlertCircle className="w-3 h-3" />
                                      Max {currentLine.max_quantity}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* ── Unit price ── */}
                              <td className="px-3 py-3 align-top">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={currentLine.unit_price}
                                  onChange={(e) =>
                                    updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full text-right bg-transparent focus:outline-none text-sm"
                                />
                              </td>

                              {/* ── Discount ── */}
                              <td className="px-3 py-3 align-top">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={currentLine.discount_amount}
                                  onChange={(e) =>
                                    updateLine(
                                      idx,
                                      "discount_amount",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full text-right bg-transparent focus:outline-none text-sm text-destructive"
                                  placeholder="0.00"
                                />
                              </td>

                              {/* ── Tax ── */}
                              <td className="px-3 py-3 align-top">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={currentLine.tax_rate}
                                  onChange={(e) =>
                                    updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full text-right bg-transparent focus:outline-none text-sm"
                                  placeholder="0"
                                />
                              </td>

                              {/* ── Line total ── */}
                              <td className="px-3 py-3 text-right font-medium text-sm align-top">
                                {formatCurrency(lineTotal)}
                              </td>

                              {/* ── Delete ── */}
                              <td className="px-2 py-3 text-center align-top">
                                <button
                                  type="button"
                                  onClick={() => remove(idx)}
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
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted/40 border-t border-border transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add another item
                    </button>
                  </div>
                )}
              </section>

              {/* ── Section 4: Notes + Totals ── */}
              <div className="flex flex-col md:flex-row gap-6 pt-1">
                {/* Notes */}
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">
                    Notes
                    <span className="ml-1 text-xs font-normal">(optional)</span>
                  </label>
                  <textarea
                    {...register("notes")}
                    rows={4}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Add any notes or payment instructions visible on the invoice…"
                  />
                </div>

                {/* Totals summary */}
                <div className="md:w-56 shrink-0">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Discount</span>
                      <span className="font-mono text-destructive">
                        −{formatCurrency(totalDiscount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Tax</span>
                      <span className="font-mono">{formatCurrency(totalTax)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2.5 border-t border-border">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-lg font-bold font-mono">
                        {formatCurrency(calculateOverallTotal())}
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
              {fields.length === 0
                ? "No items added yet"
                : `${fields.length} item${fields.length !== 1 ? "s" : ""} · Total ${formatCurrency(calculateOverallTotal())}`}
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
                form="invoice-form"
                disabled={isPending}
                className="px-5 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? "Saving…" : initialData?.id ? "Update invoice" : "Save invoice"}
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