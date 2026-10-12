"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import ImportReviewPage from "@/components/inventory/product/ImportReviewModal";
import {
  isProductImportReviewSession,
  PRODUCT_IMPORT_REVIEW_STORAGE_KEY,
  type ProductImportReviewSession,
} from "@/lib/productImportReview";

export default function ProductImportReviewRoute() {
  const router = useRouter();
  const [review, setReview] = useState<ProductImportReviewSession | null>(null);

  useEffect(() => {
    let stored: string | null;
    try {
      stored = window.sessionStorage.getItem(PRODUCT_IMPORT_REVIEW_STORAGE_KEY);
    } catch {
      toast.error("The saved import review could not be accessed in this tab.");
      router.replace("/inventory/products");
      return;
    }

    if (!stored) {
      router.replace("/inventory/products");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      try {
        window.sessionStorage.removeItem(PRODUCT_IMPORT_REVIEW_STORAGE_KEY);
      } catch {
        toast.error("The invalid import review data could not be cleared.");
      }
      toast.error("The saved import review could not be loaded. Please upload the file again.");
      router.replace("/inventory/products");
      return;
    }

    if (!isProductImportReviewSession(parsed)) {
      try {
        window.sessionStorage.removeItem(PRODUCT_IMPORT_REVIEW_STORAGE_KEY);
      } catch {
        toast.error("The invalid import review data could not be cleared.");
      }
      toast.error("The saved import review is invalid. Please upload the file again.");
      router.replace("/inventory/products");
      return;
    }

    setReview(parsed);
  }, [router]);

  const handleClose = useCallback(() => {
    try {
      window.sessionStorage.removeItem(PRODUCT_IMPORT_REVIEW_STORAGE_KEY);
    } catch {
      toast.error("The saved import review could not be cleared from this tab.");
    }
    router.push("/inventory/products");
  }, [router]);

  if (!review) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading import review…
      </div>
    );
  }

  return (
    <ImportReviewPage
      onClose={handleClose}
      rows={review.rows}
      source={review.source}
      initialPolicy={review.policy}
    />
  );
}
