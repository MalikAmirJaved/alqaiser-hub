"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { useCreateBankAccount, useUpdateBankAccount } from "@/hooks/finance/useBank";
import { useAutoCode } from "@/hooks/useAutoCode";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface BankAccountFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  onSuccess?: () => void;
}

export default function BankAccountFormModal({ open, onClose, initialData, onSuccess }: BankAccountFormModalProps) {
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isActive, setIsActive] = useState(true);

  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();
  const { generateCode, validateCode } = useAutoCode("bank_account");

  useEffect(() => {
    if (initialData) {
      setAccountName(initialData.account_name || "");
      setAccountNumber(initialData.account_number || "");
      setBankName(initialData.bank_name || "");
      setOpeningBalance(String(initialData.opening_balance || initialData.current_balance || 0));
      setCurrency(initialData.currency || "USD");
      setIsActive(initialData.is_active ?? true);
    } else {
      resetForm();
      generateCode().then(code => setAccountNumber(code)).catch(() => {});
    }
  }, [initialData, open]);

  const resetForm = () => {
    setAccountName("");
    setAccountNumber("");
    setBankName("");
    setOpeningBalance("");
    setCurrency("USD");
    setIsActive(true);
  };

  const handleSubmit = async () => {
    const data = {
      account_name: accountName,
      account_number: accountNumber,
      bank_name: bankName,
      opening_balance: parseFloat(openingBalance) || 0,
      currency: currency.toUpperCase(),
      is_active: isActive,
    };

    try {
      if (initialData) {
        await updateAccount.mutateAsync({ id: initialData.id, data });
      } else {
        await createAccount.mutateAsync(data);
      }
      onSuccess?.();
      onClose();
      resetForm();
    } catch (error) {
      console.error("Failed to save bank account:", error);
    }
  };

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <h2 className="text-xl font-semibold">{initialData ? "Edit Bank Account" : "New Bank Account"}</h2>
        </ModalHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="accountName">Account Name *</Label>
            <Input
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g., Chase Operating Account"
              required
            />
          </div>
          <div>
            <Label htmlFor="bankName">Bank Name *</Label>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g., Chase Bank"
              required
            />
          </div>
          <div>
            <Label htmlFor="accountNumber">Account Number</Label>
            <div className="flex gap-2">
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                onBlur={() => validateCode(accountNumber)}
                placeholder="e.g., ****1234"
                className="flex-1 font-mono"
              />
              <button
                type="button"
                onClick={() => generateCode().then(code => setAccountNumber(code)).catch(() => {})}
                className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition flex-shrink-0"
                title="Generate new code"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="openingBalance">Opening Balance</Label>
            <Input
              id="openingBalance"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
              maxLength={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Active</Label>
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createAccount.isPending || updateAccount.isPending}>
            {createAccount.isPending || updateAccount.isPending ? "Saving..." : initialData ? "Update" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}