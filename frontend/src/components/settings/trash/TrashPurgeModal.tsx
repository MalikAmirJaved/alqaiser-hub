// frontend/src/components/settings/trash/TrashPurgeModal.tsx
"use client";

import { useTrashDependencies } from "@/hooks/useTrash";
import { ConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { humanizeModel } from "./trashDisplay";

interface TrashPurgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  typeKey: string | null;
  entryId: string | null;
  displayName: string;
  isLoading?: boolean;
}

/**
 * Permanent-delete confirmation.
 *
 * Loads the cascade preview first so the user sees which related records will
 * disappear too — and so a row held by PROTECT relations is detected *before*
 * anything is dispatched.
 *
 * When the row is blocked there is nothing to confirm, so the single action
 * button becomes a real Close button. Wiring it to `onConfirm` instead would
 * re-issue a delete that the server refuses, and because `ConfirmationModal`
 * only closes after a successful confirm, the dialog could never be dismissed.
 */
export default function TrashPurgeModal({
  isOpen,
  onClose,
  onConfirm,
  typeKey,
  entryId,
  displayName,
  isLoading = false,
}: TrashPurgeModalProps) {
  const { data, isLoading: depsLoading } = useTrashDependencies(
    isOpen ? typeKey : null,
    isOpen ? entryId : null,
  );
  const report = data?.data;
  const dependencies = report?.dependencies ?? [];
  const blockedBy = report?.blocked_by ?? [];

  const blocked = blockedBy.length > 0;
  const relatedTotal = report?.total_related ?? 0;

  const dependencyLines = dependencies
    .map((dep) => `${dep.count} × ${humanizeModel(dep.model)}`)
    .join(", ");
  const blockerLines = blockedBy
    .map((b) => `${b.count} × ${humanizeModel(b.model)}`)
    .join(", ");

  const message = blocked
    ? `“${displayName}” cannot be deleted: it is still referenced by ${blockerLines}. ` +
      `Those records must be removed first — nothing was deleted.`
    : depsLoading
      ? `Checking what else would be deleted with “${displayName}”…`
      : relatedTotal > 0
        ? `“${displayName}” and ${relatedTotal} related record(s) (${dependencyLines}) will be deleted forever. This cannot be undone, and the item will not be recoverable from the trash.`
        : `“${displayName}” will be deleted forever. This cannot be undone, and the item will not be recoverable from the trash.`;

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      // Blocked: the button is a plain Close. Otherwise run the real delete.
      onConfirm={blocked ? onClose : onConfirm}
      title={blocked ? "Cannot delete yet" : "Delete permanently?"}
      message={message}
      type="danger"
      confirmText={blocked ? "Close" : "Delete forever"}
      isLoading={isLoading}
      // Nothing is known while the preview loads — do not offer a live delete.
      confirmDisabled={!blocked && depsLoading}
      showCancelButton={!blocked}
    />
  );
}

/**
 * Same modal but for "Empty trash" / "Purge expired" style bulk actions.
 */
export function TrashBulkPurgeModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  count,
  scopeLabel,
  blockedCount = 0,
  blockerHint,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  count: number;
  scopeLabel: string;
  /** Items that cannot be removed because immutable records reference them. */
  blockedCount?: number;
  blockerHint?: string | null;
  isLoading?: boolean;
}) {
  const base = `${count} item(s) ${scopeLabel} will be deleted forever. This cannot be undone.`;
  const blockedNote =
    blockedCount > 0
      ? ` Note: ${blockedCount} item(s) are still referenced by other records and will be kept. ${blockerHint ?? ""}`.trimEnd()
      : "";

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      message={`${base}${blockedNote}`}
      type="danger"
      confirmText="Delete forever"
      isLoading={isLoading}
    />
  );
}

// ─── Restore confirmation ─────────────────────────────────────────────────

interface TrashRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  typeKey: string | null;
  entryId: string | null;
  displayName: string;
  isLoading?: boolean;
}

/**
 * Restore confirmation. Loads the cascade preview so the user sees exactly
 * which related records will be brought back alongside the trashed root —
 * which fixes the confusion of "I restored Product but its Variants stayed
 * in the trash" because the tree is now explicit in the confirmation.
 */
export function TrashRestoreModal({
  isOpen,
  onClose,
  onConfirm,
  typeKey,
  entryId,
  displayName,
  isLoading = false,
}: TrashRestoreModalProps) {
  const { data, isLoading: depsLoading } = useTrashDependencies(
    isOpen ? typeKey : null,
    isOpen ? entryId : null,
  );
  const report = data?.data;
  const restorable = report?.restorable ?? [];
  const totalRestorable = report?.total_restorable ?? 0;

  const restorableLines = restorable
    .map((r) => `${r.count} × ${humanizeModel(r.model)}`)
    .join(", ");

  const message = depsLoading
    ? `Checking what else will be restored with “${displayName}”…`
    : totalRestorable > 0
      ? `“${displayName}” will be put back, along with ${totalRestorable} related record(s) that were deleted at the same time (${restorableLines}).`
      : `“${displayName}” will be put back. No additional related records will be restored.`;

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Restore from trash?"
      message={message}
      type="success"
      confirmText="Restore"
      isLoading={isLoading}
      confirmDisabled={depsLoading}
      showCancelButton={true}
    />
  );
}
