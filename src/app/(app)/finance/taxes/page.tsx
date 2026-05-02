// @ts-nocheck
"use client";

// ============================================
// FILE: src/routes/_app.finance.taxes.jsx (UPDATED - with Tax Report)
// ============================================
import { useState } from "react";
import CrudPage from "@/components/CrudPage";
import { schemas } from "@/config/schemas";
import TaxReport from "@/components/Finance/TaxReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default TaxesPage;

function TaxesPage() {
  const [activeTab, setActiveTab] = useState("taxes");

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="taxes">Tax Rates</TabsTrigger>
          <TabsTrigger value="rules">Tax Rules</TabsTrigger>
          <TabsTrigger value="transactions">Tax Transactions</TabsTrigger>
          <TabsTrigger value="report">Tax Report</TabsTrigger>
        </TabsList>
        
        <TabsContent value="taxes">
          <CrudPage {...schemas.taxes} />
        </TabsContent>
        
        <TabsContent value="rules">
          <CrudPage {...schemas.taxRules} />
        </TabsContent>
        
        <TabsContent value="transactions">
          <CrudPage {...schemas.taxTransactions} />
        </TabsContent>
        
        <TabsContent value="report">
          <TaxReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}