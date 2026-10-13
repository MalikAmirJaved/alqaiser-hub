// src/app/invoice-generator/page.tsx
import { Suspense } from "react";
import {InvoiceGenerator} from "./InvoiceGenerator";

export const metadata = {
  // keep whatever you already had here, or add a basic one
  title: "Invoice Generator — Free PDF Invoice Maker",
  description:
    "Create professional invoices online for free. Download high-quality PDF invoices instantly. No signup required.",
};

function GeneratorFallback() {
  return (
    <div className="mx-auto w-full max-w-[96rem] px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
      <p className="text-sm text-muted-foreground">Loading invoice generator…</p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<GeneratorFallback />}>
      <InvoiceGenerator />
    </Suspense>
  );
}