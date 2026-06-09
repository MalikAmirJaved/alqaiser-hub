"use client";

import { useParams } from "next/navigation";
import { useAsset } from "@/hooks/useAssets";
import { DetailLayout } from "@/components/reuseable/final/DetailLayout";

export default function AssetDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: asset, isLoading } = useAsset(id ?? null);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!asset) {
    return <div className="p-8 text-center">Asset not found</div>;
  }

  const total = asset.total_quantity ?? 0;
  const available = asset.available_quantity ?? 0;
  const assigned = total - available;

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Name</span>
            <span>{asset.name}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Brand</span>
            <span>{asset.brand || "—"}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Category</span>
            <span>{asset.category || "—"}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">SKU / Serial</span>
            <span>{asset.serial_number || "—"}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Total Quantity</span>
            <span>{total}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Available Quantity</span>
            <span className="font-semibold text-success">
              {available}
            </span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Assigned</span>
            <span>{assigned}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Vendor</span>
            <span>{asset.vendor || "—"}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Purchase Date</span>
            <span>{asset.purchase_date || "—"}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Purchase Price</span>
            <span>
              {asset.purchase_price != null
                ? asset.purchase_price
                : "—"}
            </span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Warranty Until</span>
            <span>{asset.warranty_until || "—"}</span>
          </div>

          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Status</span>
            <span>
              {asset.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="flex justify-between border-b pb-2 col-span-2">
            <span className="text-muted-foreground">Description</span>
            <span>{asset.description || "—"}</span>
          </div>
        </div>
      ),
    },
    {
      id: "assignments",
      label: "Assignment History",
      render: () => (
        <div className="py-8 text-center text-muted-foreground">
          Assignment history will be shown here (API integration needed)
        </div>
      ),
    },
  ];

  return (
    <DetailLayout
      entityId={asset.id}
      data={asset}
      breadcrumbs={["HR", "Assets", asset.name]}
      title={asset.name}
      status={asset.is_active ? "Active" : "Inactive"}
      subtitle={`${asset.category || "Uncategorized"} · ${
        asset.brand || "No brand"
      }`}
      tabs={tabs}
      meta={[
        {
          label: "Available",
          value: String(available),
        },
        {
          label: "Assigned",
          value: String(assigned),
        },
        {
          label: "Status",
          value: asset.is_active ? "Active" : "Inactive",
        },
      ]}
      summary={[
        {
          label: "Total Units",
          value: total,
          isCurrency: false,
        },
        {
          label: "Available",
          value: available,
          isCurrency: false,
        },
        {
          label: "Assigned",
          value: assigned,
          isCurrency: false,
        },
      ]}
      currencyFormatter={(val) => String(val)}
    />
  );
}