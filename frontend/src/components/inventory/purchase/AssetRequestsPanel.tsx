"use client";
import { useState, useMemo } from "react";
import { useAssetPurchaseRequests } from "@/hooks/useAssetPurchaseRequests";
import { Clock, Package, CheckCircle, XCircle } from "lucide-react";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";

interface AssetRequestsPanelProps {
  onConfirmRequest: (request: {
    id: string;
    asset: string;
    asset_name: string;
    quantity: number;
    under_date: string;
  }) => void;
}

export function AssetRequestsPanel({ onConfirmRequest }: AssetRequestsPanelProps) {
  const formatCurrency = useFormatCurrency();
  const { data: requests = [], isLoading } = useAssetPurchaseRequests({ status: "PENDING" });
  const [showAll, setShowAll] = useState(false);

  const displayRequests = useMemo(
    () => (showAll ? requests : requests.slice(0, 5)),
    [requests, showAll]
  );

  const totalPending = requests.length;

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground">Loading requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-medium">Pending Asset Requests</h3>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-medium rounded-full bg-amber-100 text-amber-700">
            {totalPending}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {displayRequests.map((req) => (
          <div key={req.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{req.asset_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Qty: {req.quantity}
                  {req.requested_by_name ? ` · By: ${req.requested_by_name}` : ""}
                  {req.under_date && ` · Need by: ${new Date(req.under_date).toLocaleDateString()}`}
                </p>
                {req.reason && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{req.reason}</p>
                )}
              </div>
            </div>

            <button
              onClick={() =>
                onConfirmRequest({
                  id: req.id,
                  asset: req.asset,
                  asset_name: req.asset_name,
                  quantity: req.quantity,
                  under_date: req.under_date,
                })
              }
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Confirm
            </button>
          </div>
        ))}
      </div>

      {requests.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border"
        >
          {showAll ? "Show less" : `Show all ${requests.length} requests`}
        </button>
      )}
    </div>
  );
}
