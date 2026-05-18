"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { Customer } from "@/hooks/useCustomers";
import PageHeader from "@/components/PageHeader";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useDeleteCustomer } from "@/hooks/useCustomers";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { useState } from "react";
import CustomerForm from "@/components/inventory/customers/CustomerForm";
import { useUpdateCustomer } from "@/hooks/useCustomers";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const api = useApi();
  const deleteCustomer = useDeleteCustomer();
  const updateCustomer = useUpdateCustomer();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();
  const [isEditing, setIsEditing] = useState(false);

  const { data: customer, refetch, isLoading } = useQuery<Customer>({
    queryKey: ["customer", id],
    queryFn: () => api(`/api/inventory/customers/${id}/`),
  });

  const handleDelete = () => {
    confirm({
      title: "Delete Customer",
      message: `Delete "${customer?.name}" permanently?`,
      onConfirm: async () => {
        await deleteCustomer.mutateAsync(String(id));
        router.back();
      },
    });
  };

  const handleUpdate = async (data: any) => {
    await updateCustomer.mutateAsync({ id: String(id), data });
    setIsEditing(false);
    refetch();
  };

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!customer) return <div className="p-8">Customer not found</div>;

  if (isEditing) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <PageHeader title="Edit Customer" />
        <CustomerForm initialData={customer} onSubmit={handleUpdate} onCancel={() => setIsEditing(false)} isLoading={updateCustomer.isPending} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <PageHeader title={customer.name} subtitle={`Code: ${customer.customer_code || "—"}`} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border">
            <Edit className="w-4 h-4" /> Edit
          </button>
          <button onClick={handleDelete} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold">Contact Information</h3>
          <div><span className="text-muted-foreground">Email:</span> {customer.email || "—"}</div>
          <div><span className="text-muted-foreground">Phone:</span> {customer.phone || "—"}</div>
          <div><span className="text-muted-foreground">Contact Person:</span> {customer.contact_person || "—"}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold">Address</h3>
          <div>{customer.address_line || "—"}</div>
          <div>{customer.city}, {customer.state} {customer.postal_code}</div>
          <div>{customer.country}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold">Status</h3>
          <span className={`px-2 py-1 rounded-full text-sm ${customer.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
            {customer.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
      <ConfirmModal />
    </div>
  );
}