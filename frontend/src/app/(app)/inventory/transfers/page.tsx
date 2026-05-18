// src/app/inventory/transfers/page.tsx
"use client";

import React, { useState } from "react";
import TransferList from "@/components/inventory/transfers/TransferList";
import CreateTransferForm from "@/components/inventory/transfers/CreateTransferForm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function TransfersPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="space-y-6 ">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Stock Transfers</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Transfer
        </Button>
      </div>

      <TransferList refreshTrigger={refreshKey} onTransferCompleted={handleRefresh} />

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Stock Transfer</DialogTitle>
          </DialogHeader>
          <CreateTransferForm
            onSuccess={() => {
              setIsCreateModalOpen(false);
              handleRefresh();
            }}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}