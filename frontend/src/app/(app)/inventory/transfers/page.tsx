// src/app/inventory/transfers/page.tsx
"use client";

import React, { useState } from "react";
import TransferList from "@/components/inventory/transfers/TransferList";
import CreateTransferForm from "@/components/inventory/transfers/CreateTransferForm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";

export default function TransfersPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="space-y-6 ">

       <PageHeader
        title="Stock Transfers"
        subtitle="Transfer Stock one Warehouse to another"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New Transfer
            </button>
          </div>
        }
      />

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