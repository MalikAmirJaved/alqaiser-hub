"use client";

import type { InvoiceWorkflowProps, QuoteWorkflowProps } from "./workflows";
import { InvoiceWorkflow } from "./workflows/InvoiceWorkflow";
import { QuoteWorkflow } from "./workflows/QuoteWorkflow";

export type DocumentFormProps =
  | (QuoteWorkflowProps & { documentType: "quote" })
  | (InvoiceWorkflowProps & { documentType: "invoice" });

export default function DocumentForm(props: DocumentFormProps) {
  if (props.documentType === "quote") {
    return (
      <QuoteWorkflow
        onClose={props.onClose}
        initialData={props.initialData}
        initialCustomerId={props.initialCustomerId}
        initialLeadId={props.initialLeadId}
        onSuccess={props.onSuccess}
      />
    );
  }

  return (
    <InvoiceWorkflow
      onClose={props.onClose}
      initialData={props.initialData}
      defaultValues={props.defaultValues}
      onSuccess={props.onSuccess}
      moduleCode={props.moduleCode}
    />
  );
}
