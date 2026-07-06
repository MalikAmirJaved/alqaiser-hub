"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface UserStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  onSuccess?: () => void;
  onSubmit?: (status: boolean) => Promise<void>;
}

export default function UserStatusModal({
  open,
  onOpenChange,
  user,
  onSuccess,
  onSubmit,
}: UserStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<boolean | null>(user?.is_active ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStatusChange = async () => {
    if (selectedStatus === null || selectedStatus === user?.is_active) {
      toast.info("Please select a different status");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(selectedStatus);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Change User Status
          </DialogTitle>
          <DialogDescription>
            Update the account status for <span className="font-semibold">{user?.first_name} {user?.last_name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Current Status: <span className="font-semibold">{user?.is_active ? "Active" : "Inactive"}</span>
          </p>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setSelectedStatus(true)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedStatus === true
                  ? `border-success bg-success/10`
                  : "border-transparent hover:border-success/30 bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-flex bg-success/15 text-success border-success/30`}>
                    Active
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">User can login to the system</p>
                </div>
                {selectedStatus === true && (
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                )}
              </div>
            </button>

            <button
              onClick={() => setSelectedStatus(false)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedStatus === false
                  ? `border-destructive bg-destructive/10`
                  : "border-transparent hover:border-destructive/30 bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-flex bg-destructive/15 text-destructive border-destructive/30`}>
                    Inactive
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">User cannot login to the system</p>
                </div>
                {selectedStatus === false && (
                  <CheckCircle2 className="w-5 h-5 text-destructive flex-shrink-0" />
                )}
              </div>
            </button>
          </div>

          {selectedStatus !== user?.is_active && selectedStatus !== null && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                {selectedStatus
                  ? "This user will be able to login to the system."
                  : "This user will NOT be able to login to the system."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStatusChange}
            disabled={isSubmitting || selectedStatus === null || selectedStatus === user?.is_active}
          >
            {isSubmitting ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
