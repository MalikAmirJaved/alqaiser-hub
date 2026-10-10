// frontend/src/components/settings/trash/TrashPurgeModal.tsx
"use client";

import { useTrashDependencies } from "@/hooks/useTrash";
import { ConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Skeleton } from "@/components/ui/skeleton";
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
 * Permanent-delete confirmation that first loads the cascade preview so the
 * user sees exactly which related records disappear too.
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

  const message = blocked
    ? `“${displayName}” is still referenced by ${blockedBy
        .map((b) => `${b.count} × ${humanizeModel(b.model)}`)
        .join(", ")}. Remove those records first — nothing was deleted.`
    : depsLoading
      ? `Permanently deleting “${displayName}”. Checking related records…`
      : relatedTotal > 0
        ? `“${displayName}” and ${relatedTotal} related record(s) (${dependencyLines}) will be deleted forever. This cannot be undone, and the item will not be recoverable from the trash.`
        : `“${displayName}” will be deleted forever. This cannot be undone, and the item will not be recoverable from the trash.`;

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={blocked ? "Cannot delete yet" : "Delete permanently?"}
      message={message}
      type="danger"
      confirmText={blocked ? "Close" : "Delete forever"}
      isLoading={isLoading}
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
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  count: number;
  scopeLabel: string;
  isLoading?: boolean;
}) {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      message={`${count} item(s) ${scopeLabel} will be deleted forever. This cannot be undone.`}
      type="danger"
      confirmText="Delete forever"
      isLoading={isLoading}
    />
  );
}

/** Loading placeholder used while a dependency preview is being fetched. */
export function TrashDependencySkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
