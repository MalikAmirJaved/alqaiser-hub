"use client";
import { useSalesOrders } from "@/hooks/useSalesOrder";
import { fmt } from "@/hooks/useSalesOrder";

export function SalesListPanel() {
  const { data: orders = [], isLoading } = useSalesOrders(); // fetch all orders (no status filter)

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {orders.length === 0 ? (
        <div className="text-center text-muted-foreground">No sales orders found</div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{order.order_number}</p>
                <p className="text-xs text-muted-foreground">
                  {order.customer_name || "Walk-in Customer"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.order_date).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{fmt(Number(order.total_amount))}</p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    order.status === "COMPLETE"
                      ? "bg-success/20 text-success"
                      : order.status === "DRAFT"
                      ? "bg-warning/20 text-warning"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {order.status}
                </span>
              </div>
            </div>
            {order.notes && (
              <p className="text-xs text-muted-foreground mt-2 truncate">{order.notes}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}