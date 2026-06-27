// components/finance/CustomerInvoiceFormModal.tsx
import { useEffect, useState, useCallback, memo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
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
  description?: string;
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
  overall_discount_percent: number;
  overall_tax_percent: number;
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
// ─────────────────────────────────────────────────────────────────────────────
interface ManualEntryFieldsProps {
  name: string;
  sku: string;
  description: string;
  costPrice: number | undefined;
  vendorValue: string;
  vendorName: string;
  fetchVendors: any;
  onNameBlur: (val: string) => void;
  onSkuBlur: (val: string) => void;
  onDescriptionBlur: (val: string) => void;
  onCostPriceBlur: (val: number | undefined) => void;
  onVendorChange: (val: string) => void;
}

const ManualEntryFields = memo(function ManualEntryFields({
  name,
  sku,
  description,
  costPrice,
  vendorValue,
  vendorName,
  fetchVendors,
  onNameBlur,
  onSkuBlur,
  onDescriptionBlur,
  onCostPriceBlur,
  onVendorChange,
}: ManualEntryFieldsProps) {
  const [localName, setLocalName] = useState(name);
  const [localSku, setLocalSku] = useState(sku);
  const [localDescription, setLocalDescription] = useState(description);
  const [localCostPrice, setLocalCostPrice] = useState(
    costPrice !== undefined ? String(costPrice) : ""
  );

  useEffect(() => { setLocalName(name); }, [name]);
  useEffect(() => { setLocalSku(sku); }, [sku]);
  useEffect(() => { setLocalDescription(description); }, [description]);
  useEffect(() => {
    setLocalCostPrice(costPrice !== undefined ? String(costPrice) : "");
  }, [costPrice]);

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={() => onNameBlur(localName)}
        className="w-full h-8 bg-muted/40 border border-border rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Item name…"
      />
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
            displayLabel={vendorName}
          />
        </div>
      </div>
      <input
        type="text"
        value={localDescription}
        onChange={(e) => setLocalDescription(e.target.value)}
        onBlur={() => onDescriptionBlur(localDescription)}
        className="w-full h-8 bg-muted/40 border border-border rounded-md px-3 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Description / notes for this line…"
      />
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] text-muted-foreground whitespace-nowrap">Cost price:</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={localCostPrice}
          onChange={(e) => setLocalCostPrice(e.target.value)}
          onBlur={() => onCostPriceBlur(localCostPrice !== "" ? parseFloat(localCostPrice) : undefined)}
          className="w-28 h-7 bg-muted/40 border border-border rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="0.00"
        />
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NumericCell — local-state input that only flushes to parent on blur.
// Prevents react-hook-form useFieldArray.update() from firing on every
// keystroke, which was causing the input to lose focus.
// ─────────────────────────────────────────────────────────────────────────────
interface NumericCellProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: string;
  className?: string;
  placeholder?: string;
}

const NumericCell = memo(function NumericCell({
  value,
  onChange,
  min,
  max,
  step = "1",
  className = "",
  placeholder,
}: NumericCellProps) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => { setLocal(String(value)); }, [value]);

  const handleBlur = () => {
    const parsed = parseFloat(local);
    if (!isNaN(parsed)) {
      let clamped = parsed;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      onChange(clamped);
    } else {
      // revert
      setLocal(String(value));
    }
  };

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// LineRow — memoized so typing in one row never re-renders sibling rows.
// Uses NumericCell for qty / unit_price / discount / tax to avoid re-renders
// during typing, and only flushes values to the parent on blur.
// ─────────────────────────────────────────────────────────────────────────────
interface LineRowProps {
  index: number;
  fieldId: string;
  currentLine: InvoiceLine;
  isOverStock: boolean;
  fetchVariants: any;
  variantDisplayLabel: string;
  fetchVendors: any;
  onUpdateLine: (index: number, field: keyof InvoiceLine, value: any) => void;
  onRemove: (index: number) => void;
  onToggleManual: (index: number, value: boolean) => void;
  calculateLineTotal: (line: InvoiceLine) => number;
  formatCurrency: (value: number) => string;
}

const LineRow = memo(function LineRow({
  index,
  fieldId,
  currentLine,
  isOverStock,
  fetchVariants,
  variantDisplayLabel,
  fetchVendors,
  onUpdateLine,
  onRemove,
  onToggleManual,
  calculateLineTotal,
  formatCurrency,
}: LineRowProps) {
  const lineTotal = calculateLineTotal(currentLine);

  return (
    <tr key={fieldId} className="group hover:bg-muted/20 transition-colors">
      {/* ── Item cell ── */}
      <td className="px-4 py-3 min-w-[300px] align-top">
        <div className="inline-flex rounded-md border border-border overflow-hidden mb-2 text-[11px]">
          <button
            type="button"
            onClick={() => onToggleManual(index, false)}
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
            onClick={() => onToggleManual(index, true)}
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
            onChange={(val) => onUpdateLine(index, "variant", val)}
            fetchOptions={fetchVariants}
            placeholder="Search variants…"
            displayLabel={variantDisplayLabel}
          />
        ) : (
          <ManualEntryFields
            key={`manual-${fieldId}`}
            name={currentLine.manual_variant_name || ""}
            sku={currentLine.manual_variant_sku || ""}
            description={currentLine.description || ""}
            costPrice={currentLine.cost_price}
            vendorValue={currentLine.vendor || ""}
            vendorName={currentLine.vendor_name || ""}
            fetchVendors={fetchVendors}
            onNameBlur={(val) => onUpdateLine(index, "manual_variant_name", val)}
            onSkuBlur={(val) => onUpdateLine(index, "manual_variant_sku", val)}
            onDescriptionBlur={(val) => onUpdateLine(index, "description", val)}
            onCostPriceBlur={(val) => onUpdateLine(index, "cost_price", val)}
            onVendorChange={(val) => onUpdateLine(index, "vendor", val)}
          />
        )}
      </td>

      {/* ── Qty ── */}
      <td className="px-3 py-3 align-top">
        <div className="flex flex-col items-end gap-0.5">
          <NumericCell
            value={Number(currentLine.quantity) || 0}
            onChange={(val) => onUpdateLine(index, "quantity", val)}
            min={1}
            max={currentLine.max_quantity || 999999}
            className={`w-full h-8 px-2 bg-transparent hover:bg-muted/30 focus:bg-background border border-transparent focus:border-primary/50 rounded-md text-right text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
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
        <NumericCell
          value={Number(currentLine.unit_price) || 0}
          onChange={(val) => onUpdateLine(index, "unit_price", val)}
          step="0.01"
          className="w-full h-8 px-2 bg-transparent hover:bg-muted/30 focus:bg-background border border-transparent focus:border-primary/50 rounded-md text-right text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </td>

      {/* ── Discount ── */}
      <td className="px-3 py-3 align-top">
        <NumericCell
          value={Number(currentLine.discount_amount) || 0}
          onChange={(val) => onUpdateLine(index, "discount_amount", val)}
          step="0.01"
          className="w-full h-8 px-2 bg-transparent hover:bg-muted/30 focus:bg-background border border-transparent focus:border-primary/50 rounded-md text-right text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 text-destructive placeholder:text-destructive/50"
          placeholder="0.00"
        />
      </td>

      {/* ── Tax % ── */}
      <td className="px-3 py-3 align-top">
        <NumericCell
          value={Number(currentLine.tax_rate) || 0}
          onChange={(val) => onUpdateLine(index, "tax_rate", val)}
          step="0.01"
          className="w-full h-8 px-2 bg-transparent hover:bg-muted/30 focus:bg-background border border-transparent focus:border-primary/50 rounded-md text-right text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
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
          onClick={() => onRemove(index)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Remove line"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
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
        overall_discount_percent: 0,
        overall_tax_percent: 0,
        notes: "",
        lines: [],
      },
    });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "lines",
  });

  const watchedLines = watch("lines");

  const calculateLineTotal = useCallback((line: InvoiceLine) => {
    const subtotal = line.quantity * line.unit_price;
    const discount = line.discount_amount || 0;
    const tax = (subtotal - discount) * (line.tax_rate / 100);
    return subtotal - discount + tax;
  }, []);

  const overallDiscountPct = Number(useWatch({ control, name: "overall_discount_percent" })) || 0;
  const overallTaxPct = Number(useWatch({ control, name: "overall_tax_percent" })) || 0;

  const subtotal = (watchedLines || []).reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const totalDiscount = (watchedLines || []).reduce((s, l) => s + (Number(l.discount_amount) || 0), 0);
  const totalTax = (watchedLines || []).reduce((s, l) => {
    const sub = Number(l.quantity) * Number(l.unit_price);
    const disc = Number(l.discount_amount) || 0;
    return s + (sub - disc) * ((Number(l.tax_rate) || 0) / 100);
  }, 0);
  const overallDiscountAmt = (subtotal || 0) * (overallDiscountPct / 100);
  const totalBeforeTax = (subtotal || 0) - (totalDiscount || 0) - (overallDiscountAmt || 0);
  const overallTaxAmt = (totalBeforeTax || 0) * (overallTaxPct / 100);

  useEffect(() => {
    setValue("amount", (totalBeforeTax || 0) + (overallTaxAmt || 0));
  }, [totalBeforeTax, overallTaxAmt, setValue]);

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
      setValue(
        "overall_discount_percent",
        Number((initialData as any).overall_discount_percent || 0)
      );
      setValue(
        "overall_tax_percent",
        Number((initialData as any).overall_tax_percent || 0)
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
          description: line.description || "",
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
      if (defaultValues.overall_discount_percent !== undefined) setValue("overall_discount_percent", defaultValues.overall_discount_percent);
      if (defaultValues.overall_tax_percent !== undefined) setValue("overall_tax_percent", defaultValues.overall_tax_percent);
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
        overall_discount_percent: 0,
        overall_tax_percent: 0,
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

  const addLine = useCallback(() => {
    append({
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
      cost_price: undefined,
    });
  }, [append]);

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
          description: value ? currentLines[index].description : "",
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
            setVariantDisplayLabels((prev) => ({
              ...prev,
              [index]: `${variant.product_name} (${variant.sku})`,
            }));
          }
        } catch {}
      } else {
        update(index, { ...currentLines[index], [field]: value });
      }
    },
    [api, update, watch]
  );

  const toggleManual = useCallback(
    (index: number, value: boolean) => {
      updateLine(index, "is_manual_entry", value);
    },
    [updateLine]
  );

  const handleRemove = useCallback(
    (index: number) => {
      remove(index);
    },
    [remove]
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

    payload.overall_discount_percent = Number(data.overall_discount_percent) || 0;
    payload.overall_tax_percent = Number(data.overall_tax_percent) || 0;

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
        <div className="relative w-full max-w-6xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh]">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
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
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                    Document details
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Invoice date</label>
                    <input
                      type="date"
                      {...register("invoice_date")}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
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

              <hr className="border-border" />

              {/* ── Section 2: Customer ── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                    Customer
                  </h3>
                </div>
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

              <hr className="border-border" />

              {/* ── Section 3: Line items ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
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
                        <tr className="bg-muted/40 border-b-2 border-border/60">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                            Product / Service
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-20">Qty</th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-28">Unit price</th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-24">Discount</th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-20">Tax %</th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground w-28">Total</th>
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
                          const isOverStock =
                            !currentLine.is_manual_entry &&
                            currentLine.max_quantity !== undefined &&
                            currentLine.quantity > currentLine.max_quantity;

                          return (
                            <LineRow
                              key={field.id}
                              index={idx}
                              fieldId={field.id}
                              currentLine={currentLine}
                              isOverStock={isOverStock}
                              fetchVariants={fetchVariants}
                              variantDisplayLabel={variantDisplayLabels[idx] || ""}
                              fetchVendors={fetchVendors}
                              onUpdateLine={updateLine}
                              onRemove={handleRemove}
                              onToggleManual={toggleManual}
                              calculateLineTotal={calculateLineTotal}
                              formatCurrency={formatCurrency}
                            />
                          );
                        })}
                      </tbody>
                    </table>

                    <button
                      type="button"
                      onClick={addLine}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-primary hover:bg-primary/5 border-t border-border transition-colors rounded-b-xl"
                    >
                      <Plus className="w-4 h-4" />
                      Add another item
                    </button>
                  </div>
                )}
              </section>

              {/* ── Section 4: Notes + Totals ── */}
              <div className="flex flex-col md:flex-row gap-6 pt-1">
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

                <div className="md:w-[340px] shrink-0">
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Discount (line)</span>
                      <span className="font-mono text-destructive">−{formatCurrency(totalDiscount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Tax (line)</span>
                      <span className="font-mono">{formatCurrency(totalTax)}</span>
                    </div>

                    {/* Overall discount % */}
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">Discount</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={overallDiscountPct}
                          onChange={(e) => setValue("overall_discount_percent", parseFloat(e.target.value) || 0)}
                          className="w-14 h-6 text-xs text-right bg-background border border-border rounded px-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                      <span className="font-mono text-sm text-destructive">
                        −{formatCurrency(overallDiscountAmt)}
                      </span>
                    </div>

                    {/* Overall tax % */}
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">Tax</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={overallTaxPct}
                          onChange={(e) => setValue("overall_tax_percent", parseFloat(e.target.value) || 0)}
                          className="w-14 h-6 text-xs text-right bg-background border border-border rounded px-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                      <span className="font-mono text-sm">
                        +{formatCurrency(overallTaxAmt)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-border">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-lg font-bold font-mono">
                        {formatCurrency((totalBeforeTax || 0) + (overallTaxAmt || 0))}
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
                : `${fields.length} item${fields.length !== 1 ? "s" : ""} · Total ${formatCurrency((totalBeforeTax || 0) + (overallTaxAmt || 0))}`}
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
