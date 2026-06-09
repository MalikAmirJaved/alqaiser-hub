"use client";

import { useEffect, useState } from "react";
import { useCreateBudget, useUpdateBudget } from "@/hooks/finance/useBudgets";
import { useAccounts } from "@/hooks/finance/useAccounts";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts
                  ?.filter((acc) => ["EXPENSE", "INCOME"].includes(acc.account_type))
                  .map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name} ({acc.account_type})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Period Type</Label>
            <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="YEARLY">Yearly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === "MONTHLY" && (
            <div>
              <Label>Month</Label>
              <Select value={month?.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {periodType === "QUARTERLY" && (
            <div>
              <Label>Quarter</Label>
              <Select value={quarter?.toString()} onValueChange={(v) => setQuarter(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
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