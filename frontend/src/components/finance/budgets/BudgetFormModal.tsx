"use client";

import { useEffect, useState } from "react";
import { useCreateBudget, useUpdateBudget } from "@/hooks/finance/useBudgets";
import { useAccounts } from "@/hooks/finance/useAccounts";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

export default function BudgetFormModal({ open, onClose, initialData, selectedYear, onSuccess }) {
  const [accountId, setAccountId] = useState("");
  const [periodType, setPeriodType] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">("YEARLY");
  const [month, setMonth] = useState<number | undefined>();
  const [quarter, setQuarter] = useState<number | undefined>();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: accounts } = useAccounts();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();

  useEffect(() => {
    if (initialData) {
      setAccountId(initialData.account);
      setPeriodType(initialData.period_type);
      setMonth(initialData.month);
      setQuarter(initialData.quarter);
      setAmount(String(initialData.amount));
      setNotes(initialData.notes || "");
    } else {
      reset();
    }
  }, [initialData]);

  const reset = () => {
    setAccountId("");
    setPeriodType("YEARLY");
    setMonth(undefined);
    setQuarter(undefined);
    setAmount("");
    setNotes("");
  };

  const handleSubmit = async () => {
    const data: any = {
      account: accountId,
      period_type: periodType,
      year: selectedYear,
      amount: parseFloat(amount),
      notes,
    };
    if (periodType === "MONTHLY" && month) data.month = month;
    if (periodType === "QUARTERLY" && quarter) data.quarter = quarter;

    if (initialData) {
      await updateBudget.mutateAsync({ id: initialData.id, data });
    } else {
      await createBudget.mutateAsync(data);
    }
    onSuccess?.();
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>{initialData ? "Edit Budget" : "New Budget"}</ModalHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Account</Label>
            <SearchableSelect
              value={accountId}
              onChange={setAccountId}
              options={(accounts || [])
                .filter((acc) => ["EXPENSE", "INCOME"].includes(acc.account_type))
                .map((acc) => ({ value: acc.id, label: `${acc.code} - ${acc.name} (${acc.account_type})` }))}
              placeholder="Select account"
            />
          </div>
          <div>
            <Label>Period Type</Label>
            <SearchableSelect
              value={periodType}
              onChange={(v: any) => setPeriodType(v)}
              options={[
                { value: "YEARLY", label: "Yearly" },
                { value: "QUARTERLY", label: "Quarterly" },
                { value: "MONTHLY", label: "Monthly" },
              ]}
              placeholder="Select period"
            />
          </div>
          {periodType === "MONTHLY" && (
            <div>
              <Label>Month</Label>
              <SearchableSelect
                value={month?.toString() || ""}
                onChange={(v) => setMonth(parseInt(v))}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                placeholder="Select month"
              />
            </div>
          )}
          {periodType === "QUARTERLY" && (
            <div>
              <Label>Quarter</Label>
              <SearchableSelect
                value={quarter?.toString() || ""}
                onChange={(v) => setQuarter(parseInt(v))}
                options={[
                  { value: "1", label: "Q1" },
                  { value: "2", label: "Q2" },
                  { value: "3", label: "Q3" },
                  { value: "4", label: "Q4" },
                ]}
                placeholder="Select quarter"
              />
            </div>
          )}
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{initialData ? "Update" : "Create"}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}