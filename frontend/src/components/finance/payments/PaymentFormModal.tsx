"use client";

import { useEffect, useState } from "react";
import { useCreatePayment, useUpdatePayment, type Payment } from "@/hooks/finance/usePayments";
import { useSupplierBills } from "@/hooks/finance/useSupplierBills";
import { useCustomerInvoices } from "@/hooks/finance/useCustomerInvoices";
import { useBankAccounts } from "@/hooks/finance/useBank";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";

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
  const [supplierBillId, setSupplierBillId] = useState("");
  const [customerInvoiceId, setCustomerInvoiceId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [notes, setNotes] = useState("");

  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const { data: supplierBillsRaw } = useSupplierBills();
  const { data: customerInvoicesRaw } = useCustomerInvoices();
  const supplierBills = (supplierBillsRaw ?? []).filter((b) => b.payment_status !== "PAID");
  const customerInvoices = (customerInvoicesRaw ?? []).filter((i) => i.payment_status !== "PAID");
  const { data: bankAccounts } = useBankAccounts();

  useEffect(() => {
    if (initialData) {
      setPaymentType(initialData.payment_type);
      setPaymentMethod(initialData.payment_method);
      setAmount(String(initialData.amount));
      setPaymentDate(initialData.payment_date);
      setReferenceNumber(initialData.reference_number || "");
      setSupplierBillId(initialData.supplier_bill || "");
      setCustomerInvoiceId(initialData.customer_invoice || "");
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
    setSupplierBillId("");
    setCustomerInvoiceId("");
    setBankAccountId("");
    setNotes("");
  };

  const handleSubmit = async () => {
    const payload: any = {
      payment_type: paymentType,
      payment_method: paymentMethod,
      amount: parseFloat(amount),
      payment_date: paymentDate,
      reference_number: referenceNumber,
      notes,
    };
    if (paymentType === "RECEIPT" && customerInvoiceId) payload.customer_invoice = customerInvoiceId;
    if (paymentType === "PAYMENT" && supplierBillId) payload.supplier_bill = supplierBillId;
    if (bankAccountId) payload.bank_account = bankAccountId;

    if (initialData) {
      await updatePayment.mutateAsync({ id: initialData.id, data: payload });
    } else {
      await createPayment.mutateAsync(payload);
    }
    onSuccess?.();
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>{initialData ? "Edit Payment" : "New Payment"}</ModalHeader>
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
          {paymentType === "RECEIPT" && (
            <div>
              <Label>Customer Invoice</Label>
              <SearchableSelect
                value={customerInvoiceId}
                onChange={setCustomerInvoiceId}
                options={(customerInvoices || []).map((inv) => ({ value: inv.id, label: `${inv.invoice_number} - ${formatCurrency(Number(inv.outstanding))}` }))}
                placeholder="Select invoice"
              />
            </div>
          )}
          {paymentType === "PAYMENT" && (
            <div>
              <Label>Supplier Bill</Label>
              <SearchableSelect
                value={supplierBillId}
                onChange={setSupplierBillId}
                options={(supplierBills || []).map((bill) => ({ value: bill.id, label: `${bill.bill_number} - ${formatCurrency(bill.outstanding)}` }))}
                placeholder="Select bill"
              />
            </div>
          )}
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
            {initialData ? "Update" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}