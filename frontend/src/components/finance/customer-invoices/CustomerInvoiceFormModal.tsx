import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { X, UserPlus } from "lucide-react";
import {
  useCreateCustomerInvoice,
  useUpdateCustomerInvoice,
  type CustomerInvoice,
} from "@/hooks/finance/useCustomerInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerForm from "@/components/inventory/customers/CustomerForm";

interface CustomerInvoiceFormData {
  invoice_number: string;
  customer: string;                   // UUID
  sales_order: string | null;        // UUID or null
  invoice_date: string;
  due_date: string;
  amount: number;
  notes: string;
  new_customer?: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: CustomerInvoice | null;
  onSuccess?: () => void;
}

// Helper to convert string | number to number
const toNumber = (value: number | string | undefined): number => {
  if (value === undefined || value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function CustomerInvoiceFormModal({ open, onClose, initialData, onSuccess }: Props) {
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<any>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm<CustomerInvoiceFormData>({
    defaultValues: {
      invoice_number: "",
      customer: "",
      sales_order: null,
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: "",
      amount: 0,
      notes: "",
    },
  });
  const createInvoice = useCreateCustomerInvoice();
  const updateInvoice = useUpdateCustomerInvoice();
  const { data: customers } = useCustomers();

  useEffect(() => {
    if (initialData) {
      setValue("invoice_number", initialData.invoice_number);
      setValue("customer", initialData.customer);
      setValue("sales_order", initialData.sales_order);
      setValue("invoice_date", initialData.invoice_date);
      setValue("due_date", initialData.due_date);
      // Convert amount to number safely
      setValue("amount", toNumber(initialData.amount));
      setValue("notes", initialData.notes);
      setNewCustomerData(null);
    } else {
      reset({
        invoice_number: "",
        customer: "",
        sales_order: null,
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: "",
        amount: 0,
        notes: "",
      });
      setNewCustomerData(null);
    }
  }, [initialData, setValue, reset, open]);

  const onSubmit = async (data: CustomerInvoiceFormData) => {
    if (initialData) {
      await updateInvoice.mutateAsync({ id: initialData.id, data });
    } else {
      await createInvoice.mutateAsync({ ...data, new_customer: newCustomerData });
    }
    onSuccess?.();
    onClose();
  };

  const handleInlineCustomerSubmit = async (data: any) => {
    setNewCustomerData(data);
    setShowCustomerForm(false);
    setValue("customer", "");
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold">
              {initialData ? "Edit Customer Invoice" : "New Customer Invoice"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
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
                  {...register("customer", { required: !newCustomerData })}
                  disabled={!!newCustomerData}
                  className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-sm"
                >
                  <option value="">Select customer</option>
                  {customers?.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} ({cust.customer_code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCustomerForm(true)}
                  className="p-2 rounded-md border border-border hover:bg-muted text-primary"
                  title="Add New Customer"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              {newCustomerData && (
                <div className="mt-1 text-xs text-success flex items-center gap-1">
                  New Customer: {newCustomerData.name} 
                  <button type="button" onClick={() => setNewCustomerData(null)} className="text-destructive hover:underline ml-2">Clear</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Invoice Date *</label>
                <input
                  type="date"
                  {...register("invoice_date", { required: true })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Due Date *</label>
                <input
                  type="date"
                  {...register("due_date", { required: true })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                {...register("amount", { required: true, valueAsNumber: true })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                {...register("notes")}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              />
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

      {showCustomerForm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <h2 className="text-xl font-semibold mb-4">New Customer</h2>
            <CustomerForm
              onSubmit={handleInlineCustomerSubmit}
              onCancel={() => setShowCustomerForm(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}