"use client";

import { useParams } from "next/navigation";
import { useAssetCategory } from "@/hooks/useAssetCategories";
import { DetailLayout } from "@/components/reuseable/final/DetailLayout";

export default function AssetCategoryDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: category, isLoading } = useAssetCategory(id ?? null);

  if (isLoading) return <div>Loading...</div>;
  if (!category) return <div>Category not found</div>;

  const totalAssets = category.assets?.length ?? 0;

  const assignedAssets =
    category.assets?.filter((a) => a.isAssigned).length ?? 0;

  const availableAssets = totalAssets - assignedAssets;

  const tabs = [
    {
      id: "assets",
      label: "Assets in Kit",
      count: totalAssets,
      render: () => (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Brand</th>
              <th className="px-4 py-2 text-right">Available</th>
              <th className="px-4 py-2 text-right">Assigned</th>
            </tr>
          </thead>

          <tbody>
            {category.assets?.map((asset) => (
              <tr key={asset.id} className="border-b">
                <td className="px-4 py-2">{asset.name}</td>
                <td className="px-4 py-2">{asset.brand || "—"}</td>

                <td className="px-4 py-2 text-right">
                  {"availableQuantity" in asset
                    ? (asset as any).availableQuantity
                    : 0}
                </td>

                <td className="px-4 py-2 text-right">
                  {"isAssigned" in asset
                    ? (asset as any).isAssigned
                      ? "Yes"
                      : "No"
                    : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
  ];

  return (
    <DetailLayout
      entityId={category.id}
      data={category}
      breadcrumbs={["HR", "Asset Kits", category.name]}
      title={category.name}
      status={category.isActive ? "Active" : "Inactive"}
      tabs={tabs}
      meta={[
        { label: "Total Assets", value: String(totalAssets) },
        { label: "Assigned", value: String(assignedAssets) },
      ]}
      summary={[
        {
          label: "Assets in Kit",
          value: totalAssets,
          isCurrency: false,
        },
        {
          label: "Assigned",
          value: assignedAssets,
          isCurrency: false,
        },
        {
          label: "Available",
          value: availableAssets,
          isCurrency: false,
        },
      ]}
    />
  );
}