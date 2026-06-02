"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import {
  useCreatePayment,
  useUpdatePayment,
  paymentTypeOptions,
  paymentMethodOptions,
  type Payment,
} from "@/hooks/finance/usePayments";
import { useBankAccounts } from "@/hooks/finance/useBank";
import { useSupplierBills } from "@/hooks/finance/useSupplierBills";
import { useCustomerInvoices } from "@/hooks/finance/useCustomerInvoices";
import { formatCurrency } from "@/lib/currency";

interface PaymentFormData {
  payment_type: "RECEIPT" | "PAYMENT";
  payment_method: Payment["payment_method"];
  amount: number;
  payment_date: string;
  reference_number: string;
  supplier_bill: number | null;
  customer_invoice: number | null;
  bank_account: number | null;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: Payment | null;
}

export default function PaymentFormModal({ open, onClose, initialData }: Props) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<PaymentFormData>({
    defaultValues: {
      payment_type: "RECEIPT",
      payment_method: "BANK_TRANSFER",
      amount: 0,
      payment_date: new Date().toISOString().split("T")[0],
      reference_number: "",
      supplier_bill: null,
      customer_invoice: null,
      bank_account: null,
      notes: "",
    },
  });

  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const { data: bankAccounts } = useBankAccounts({ is_active: true });
  const { data: supplierBills } = useSupplierBills({ status: "POSTED" });
  const { data: customerInvoices } = useCustomerInvoices({ status: "POSTED" });

  const paymentType = watch("payment_type");

  useEffect(() => {
    if (initialData) {
      setValue("payment_type", initialData.payment_type);
      setValue("payment_method", initialData.payment_method);
      setValue("amount", initialData.amount);
      setValue("payment_date", initialData.payment_date);
      setValue("reference_number", initialData.reference_number);
      setValue("supplier_bill", initialData.supplier_bill);
      setValue("customer_invoice", initialData.customer_invoice);
      setValue("bank_account", initialData.bank_account);
      setValue("notes", initialData.notes);
    } else {
      reset({
        payment_type: "RECEIPT",
        payment_method: "BANK_TRANSFER",
        amount: 0,
        payment_date: new Date().toISOString().split("T")[0],
        reference_number: "",
        supplier_bill: null,
        customer_invoice: null,
        bank_account: null,
        notes: "",
      });
    }
  }, [initialData, setValue, reset]);

  const onSubmit = async (data: PaymentFormData) => {
    if (initialData) {
      await updatePayment.mutateAsync({ id: initialData.id, data });
    } else {
      await createPayment.mutateAsync(data);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {initialData ? "Edit Payment" : "Record Payment"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              {...register("payment_type", { required: "Type is required" })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {paymentTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Method *</label>
            <select
              {...register("payment_method", { required: "Method is required" })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {paymentMethodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input
              type="date"
              {...register("payment_date", { required: "Date is required" })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              {...register("amount", { required: "Amount is required", valueAsNumber: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reference Number</label>
            <input
              {...register("reference_number")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., CHQ-001, TRF-123, RCP-001"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cheque number, transaction ID, or reference code
            </p>
          </div>

          {/* Conditional linking: show supplier bills for PAYMENT */}
          {paymentType === "PAYMENT" && (
            <div>
              <label className="block text-sm font-medium mb-1">Supplier Bill (optional)</label>
              <select
                {...register("supplier_bill", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Select bill to pay --</option>
                {supplierBills?.map((bill) => (
                  <option key={bill.id} value={bill.id}>
                    {bill.bill_number} - {bill.supplier_name || `Supplier #${bill.supplier}`} - {formatCurrency(bill.amount)} (Outstanding: {formatCurrency(bill.outstanding)})
                  </option>
                ))}
              </select>
              {supplierBills?.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No posted bills available. Create and post a supplier bill first.
                </p>
              )}
            </div>
          )}

          {/* Conditional linking: show customer invoices for RECEIPT */}
          {paymentType === "RECEIPT" && (
            <div>
              <label className="block text-sm font-medium mb-1">Customer Invoice (optional)</label>
              <select
                {...register("customer_invoice", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Select invoice to receive payment --</option>
                {customerInvoices?.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} - {inv.customer_name || `Customer #${inv.customer}`} - {formatCurrency(inv.amount)} (Outstanding: {formatCurrency(inv.outstanding)})
                  </option>
                ))}
              </select>
              {customerInvoices?.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No posted invoices available. Create and post a customer invoice first.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Bank Account (optional)</label>
            <select
              {...register("bank_account", { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Select bank account --</option>
              {bankAccounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bank_name} - {acc.account_name} ({acc.account_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Additional information about this payment..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPayment.isPending || updatePayment.isPending}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {createPayment.isPending || updatePayment.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}