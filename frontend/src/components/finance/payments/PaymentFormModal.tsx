"use client";

import { useEffect, useState } from "react";
import { useCreatePayment, useUpdatePayment, type Payment } from "@/hooks/finance/usePayments";
import { useSupplierBills } from "@/hooks/finance/useSupplierBills";
import { useCustomerInvoices } from "@/hooks/finance/useCustomerInvoices";
import { useBankAccounts } from "@/hooks/finance/useBank";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
            <Select value={paymentType} onValueChange={(v: "RECEIPT" | "PAYMENT") => setPaymentType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RECEIPT">Receipt (Customer Payment)</SelectItem>
                <SelectItem value="PAYMENT">Payment (Supplier Payment)</SelectItem>
              </SelectContent>
            </Select>
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
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
                <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentType === "RECEIPT" && (
            <div>
              <Label>Customer Invoice</Label>
              <Select value={customerInvoiceId} onValueChange={setCustomerInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {customerInvoices?.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} - {formatCurrency(Number(inv.outstanding))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {paymentType === "PAYMENT" && (
            <div>
              <Label>Supplier Bill</Label>
              <Select value={supplierBillId} onValueChange={setSupplierBillId}>
                <SelectTrigger><SelectValue placeholder="Select bill" /></SelectTrigger>
                <SelectContent>
                  {supplierBills?.map((bill) => (
                    <SelectItem key={bill.id} value={bill.id}>{bill.bill_number} - {formatCurrency(bill.outstanding)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Bank Account</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
              <SelectContent>
                {bankAccounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.account_name} ({acc.bank_name})</SelectItem>
                ))}
              </SelectContent>
            </Select>
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