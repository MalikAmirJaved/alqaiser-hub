# Quote and Invoice Document Workflow

**Status:** Implemented

## Scope

Consolidate Sales quote and customer-invoice create/edit into a shared, authenticated page workflow. Preserve their domain-specific validation and API behavior while sharing the document editor, appearance controls, live preview, and CRM print/PDF renderer.

## Delivered

- Reused `DocumentForm` with quote- and invoice-specific workflows; create/edit is page-based, not a modal, and there is no public `/invoice-generator` route.
- Persisted template, accent color, and typography with the quote or invoice and aligned editor preview with CRM print/PDF output.
- Included company logo, selected customer, line and overall discount/tax, and terms in the relevant preview/detail/print flows.
- Preserved user-supplied quote/invoice numbers and generated numbers only as fallbacks, including quote-to-invoice conversion.
- Added the approved-quote conversion action and carried quote details into invoice creation.
- Corrected decimal-string arithmetic in detail totals and allowed eligible PENDING Sales invoices to be edited.

## Verification

The implementation was checked with focused backend tests, frontend TypeScript/build validation, and `git diff --check`. Documentation-only follow-up changes are separately checked with `git diff --check`.
