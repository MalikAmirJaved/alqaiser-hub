// components/finance/CustomerInvoiceFormModal.tsx
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { X, Plus, Trash2, Search } from "lucide-react";
import {
  useCreateCustomerInvoice,
  useUpdateCustomerInvoice,
  type CustomerInvoice,
} from "@/hooks/finance/useCustomerInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useAllVariantsSimple } from "@/hooks/useAllVariants";
import CustomerCreationModal from "@/components/sales/CustomerCreationModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";

interface InvoiceLine {
  variant: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  variant_name?: string;
  variant_sku?: string;
}

interface CustomerInvoiceFormData {
  invoice_number: string;
  customer: string;
  invoice_date: string;
  due_date: string;
  amount: number;               // ← Added
  notes: string;
  lines: InvoiceLine[];
  new_customer?: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: CustomerInvoice | null;
  onSuccess?: () => void;
}

export default function CustomerInvoiceFormModal({ open, onClose, initialData, onSuccess }: Props) {
  const formatCurrency = useFormatCurrency();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerInfo, setNewCustomerInfo] = useState<any>(null);
  const { data: customers = [], refetch: refetchCustomers } = useCustomers("");
  const { data: variants = [] } = useAllVariantsSimple({ active_only: true });
  const createInvoice = useCreateCustomerInvoice();
  const updateInvoice = useUpdateCustomerInvoice();

  const { register, control, handleSubmit, reset, setValue, watch } = useForm<CustomerInvoiceFormData>({
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  const watchedLines = watch("lines");

  // Calculate line total (after discount + tax)
  const calculateLineTotal = (line: InvoiceLine) => {
    const subtotal = line.quantity * line.unit_price;
    const discount = line.discount_amount || 0;
    const tax = (subtotal - discount) * (line.tax_rate / 100);
    return subtotal - discount + tax;
  };

  // Calculate overall invoice total from lines
  const calculateOverallTotal = () => {
    return (watchedLines || []).reduce((sum, line) => sum + calculateLineTotal(line), 0);
  };

  // Update the amount field whenever lines change
  useEffect(() => {
    const total = calculateOverallTotal();
    setValue("amount", total);
  }, [watchedLines, setValue]);

  useEffect(() => {
    if (initialData) {
      setValue("invoice_number", initialData.invoice_number);
      setValue("customer", initialData.customer);
      setValue("invoice_date", initialData.invoice_date);
      setValue("due_date", initialData.due_date);
      setValue("amount", typeof initialData.amount === "string" ? parseFloat(initialData.amount) : initialData.amount);
      setValue("notes", initialData.notes);
      setValue(
        "lines",
        (initialData.lines || []).map((line) => ({
          variant: line.variant,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount || 0,
          tax_rate: line.tax_rate || 0,
          variant_name: line.variant_name,
          variant_sku: line.variant_sku,
        }))
      );
      setNewCustomerInfo(null);
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
      setNewCustomerInfo(null);
    }
  }, [initialData, setValue, reset, open]);

  const handleCustomerCreated = async (customerId: string, customerName: string, customerData: any) => {
    await refetchCustomers();
    setNewCustomerInfo(customerData);
    setValue("customer", customerId);
  };

  const addLine = () => {
    append({ variant: "", quantity: 1, unit_price: 0, discount_amount: 0, tax_rate: 0 });
  };

  const updateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    const currentLines = watch("lines");
    const newLines = [...currentLines];
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
    setValue("lines", newLines);
  };

  const onSubmit = async (data: CustomerInvoiceFormData) => {
    const payload: any = { ...data };
    // Ensure amount is sent as number
    payload.amount = typeof payload.amount === "number" ? payload.amount : parseFloat(payload.amount);
    if (newCustomerInfo) {
      payload.new_customer = newCustomerInfo;
      delete payload.customer;
    } else if (!payload.customer) {
      delete payload.customer;
    }
    // Clean lines
    payload.lines = payload.lines.map((line: any) => ({
      variant: line.variant,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_amount: line.discount_amount || 0,
      tax_rate: line.tax_rate || 0,
    }));

    if (initialData) {
      await updateInvoice.mutateAsync({ id: initialData.id, data: payload });
    } else {
      await createInvoice.mutateAsync(payload);
    }
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border p-4 sticky top-0 bg-card z-10">
            <h2 className="text-lg font-semibold">
              {initialData ? "Edit Customer Invoice" : "New Customer Invoice"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-6">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Invoice Number *</label>
                <input
                  {...register("invoice_number", { required: true })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  placeholder="e.g., INV-2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Customer *</label>
                <div className="flex gap-2">
                  <select
                    {...register("customer", { required: !newCustomerInfo })}
                    disabled={!!newCustomerInfo}
                    className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm"
                  >
                    <option value="">Select customer</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name} ({cust.customer_code})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="p-2 rounded-md border border-border hover:bg-muted text-primary"
                    title="Add New Customer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {newCustomerInfo && (
                  <div className="mt-1 text-xs text-success flex items-center gap-1">
                    New Customer: {newCustomerInfo.name}
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustomerInfo(null);
                        setValue("customer", "");
                      }}
                      className="text-destructive hover:underline ml-2"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Invoice Date</label>
                <input
                  type="date"
                  {...register("invoice_date")}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  {...register("due_date")}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium">Invoice Items</label>
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
                    {fields.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground">
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          No items added
                        </td>
                      </tr>
                    ) : (
                      fields.map((field, idx) => {
                        const currentLine = watchedLines?.[idx] || {
                          quantity: 1,
                          unit_price: 0,
                          discount_amount: 0,
                          tax_rate: 0,
                        };
                        const lineTotal = calculateLineTotal(currentLine);
                        return (
                          <tr key={field.id} className="border-t border-border">
                            <td className="px-3 py-2">
                              <select
                                value={currentLine.variant || ""}
                                onChange={(e) => updateLine(idx, "variant", e.target.value)}
                                className="w-full bg-transparent focus:outline-none"
                                required
                              >
                                <option value="">Select variant</option>
                                {variants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.product_name} ({v.sku})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={currentLine.quantity}
                                onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 1)}
                                className="w-full text-right bg-transparent focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={currentLine.unit_price}
                                onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)}
                                className="w-full text-right bg-transparent focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={currentLine.discount_amount}
                                onChange={(e) => updateLine(idx, "discount_amount", parseFloat(e.target.value) || 0)}
                                className="w-full text-right bg-transparent focus:outline-none"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={currentLine.tax_rate}
                                onChange={(e) => updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)}
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
                                onClick={() => remove(idx)}
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
                  {...register("notes")}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                  placeholder="Additional notes for this invoice..."
                />
              </div>
              <div className="w-48 space-y-2 text-right">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>
                    {formatCurrency(
                      (watchedLines || []).reduce(
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
                      (watchedLines || []).reduce(
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
                      (watchedLines || []).reduce((s, l) => {
                        const subtotal = l.quantity * l.unit_price;
                        const discount = l.discount_amount || 0;
                        return s + (subtotal - discount) * (l.tax_rate / 100);
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(calculateOverallTotal())}</span>
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
                disabled={createInvoice.isPending || updateInvoice.isPending}
                className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
              >
                {createInvoice.isPending || updateInvoice.isPending ? "Saving..." : "Save"}
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