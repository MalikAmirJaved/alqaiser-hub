"use client";

import { useEffect, useState } from "react";
import { useCreatePayment, useUpdatePayment, useConfirmPayment, type Payment } from "@/hooks/finance/usePayments";
import { useSupplierBills } from "@/hooks/finance/useSupplierBills";
import { useCustomerInvoices } from "@/hooks/finance/useCustomerInvoices";
import { useBankAccounts } from "@/hooks/finance/useBank";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { toast } from "sonner";

interface PaymentFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Payment | null;
  onSuccess?: () => void;
}

export default function PaymentFormModal({ open, onClose, initialData, onSuccess }: PaymentFormModalProps) {
  const formatCurrency = useFormatCurrency();
  const [paymentType, setPaymentType] = useState<"RECEIPT" | "PAYMENT">("RECEIPT");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [payableType, setPayableType] = useState<"supplier_bill" | "customer_invoice" | "">("");
  const [payableId, setPayableId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [notes, setNotes] = useState("");

  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const confirmPayment = useConfirmPayment();
  const { data: supplierBillsRaw } = useSupplierBills();
  const { data: customerInvoicesRaw } = useCustomerInvoices();
  const supplierBills = (supplierBillsRaw ?? []).filter((b) => b.payment_status !== "PAID");
  const customerInvoices = (customerInvoicesRaw ?? []).filter((i) => i.payment_status !== "PAID");
  const { data: bankAccounts } = useBankAccounts();
  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setPaymentType(initialData.payment_type);
      setPaymentMethod(initialData.payment_method);
      setAmount(String(initialData.amount));
      setPaymentDate(initialData.payment_date);
      setReferenceNumber(initialData.reference_number || "");
      setPayableType((initialData.payable_type as any) || "");
      setPayableId(initialData.payable_id || "");
      setBankAccountId(initialData.bank_account || "");
      setNotes(initialData.notes || "");
    } else {
      resetForm();
    }
  }, [initialData]);

  const resetForm = () => {
    setPaymentType("RECEIPT");
    setPaymentMethod("BANK_TRANSFER");
    setAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setReferenceNumber("");
    setPayableType("");
    setPayableId("");
    setBankAccountId("");
    setNotes("");
  };

  // Sync payableType when paymentType changes
  useEffect(() => {
    if (!initialData) {
      setPayableType(paymentType === "RECEIPT" ? "customer_invoice" : "supplier_bill");
      setPayableId("");
    }
  }, [paymentType, initialData]);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Amount is required");
      return;
    }
    if (!payableType || !payableId) {
      toast.error(`Please select a ${paymentType === "RECEIPT" ? "customer invoice" : "supplier bill"}`);
      return;
    }

    const payload: any = {
      payable_type: payableType,
      payable_id: payableId,
      amount: parseFloat(amount),
      payment_date: paymentDate,
      payment_method: paymentMethod,
    };
    if (bankAccountId) payload.bank_account = bankAccountId;
    if (referenceNumber) payload.reference_number = referenceNumber;
    if (notes) payload.notes = notes;

    try {
      if (isEditing) {
        await updatePayment.mutateAsync({ id: initialData.id, data: payload });
        toast.success("Payment updated");
      } else {
        const result = await createPayment.mutateAsync(payload as any);
        toast.success("Payment created");
        // Auto-confirm after creation
        if (result?.id) {
          try {
            await confirmPayment.mutateAsync(result.id);
            toast.success("Payment confirmed");
          } catch {
            toast.warning("Payment created but confirmation failed");
          }
        }
      }
      onSuccess?.();
      onClose();
    } catch {
      // Error toast is handled by apiFetch
    }
  };

  const payableOptions = (): { value: string; label: string }[] => {
    if (payableType === "supplier_bill") {
      return (supplierBills || []).map((bill) => ({
        value: bill.id,
        label: `${bill.bill_number} - ${formatCurrency(bill.outstanding)}`,
      }));
    }
    if (payableType === "customer_invoice") {
      return (customerInvoices || []).map((inv) => ({
        value: inv.id,
        label: `${inv.invoice_number} - ${formatCurrency(Number(inv.outstanding))}`,
      }));
    }
    return [];
  };

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>{isEditing ? "Edit Payment" : "New Payment"}</ModalHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Type</Label>
            <SearchableSelect
              value={paymentType}
              onChange={(v: any) => setPaymentType(v)}
              options={[
                { value: "RECEIPT", label: "Receipt (Customer Payment)" },
                { value: "PAYMENT", label: "Payment (Supplier Payment)" },
              ]}
              placeholder="Select type"
            />
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <Label>Method</Label>
            <SearchableSelect
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={[
                { value: "CASH", label: "Cash" },
                { value: "BANK_TRANSFER", label: "Bank Transfer" },
                { value: "CHEQUE", label: "Cheque" },
                { value: "CREDIT_CARD", label: "Credit Card" },
                { value: "OTHER", label: "Other" },
              ]}
              placeholder="Select method"
            />
          </div>
          <div>
            <Label>{paymentType === "RECEIPT" ? "Customer Invoice" : "Supplier Bill"}</Label>
            <SearchableSelect
              value={payableId}
              onChange={setPayableId}
              options={payableOptions()}
              placeholder={`Select ${paymentType === "RECEIPT" ? "invoice" : "bill"}`}
            />
          </div>
          <div>
            <Label>Bank Account</Label>
            <SearchableSelect
              value={bankAccountId}
              onChange={setBankAccountId}
              options={(bankAccounts || []).map((acc) => ({ value: acc.id, label: `${acc.account_name} (${acc.bank_name})` }))}
              placeholder="Select bank account"
            />
          </div>
          <div>
            <Label>Reference Number (optional)</Label>
            <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createPayment.isPending || updatePayment.isPending}>
            {isEditing ? "Update" : "Create & Confirm"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
