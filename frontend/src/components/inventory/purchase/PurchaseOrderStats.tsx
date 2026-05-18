// src/components/purchase/PurchaseOrderStats.tsx
import { StatsCards } from '@/components/reuseable/StatsCards';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';

export function PurchaseOrderStats() {
  const { data: orders = [] } = usePurchaseOrders();

  const totalOrders = orders.length;
  const draftCount = orders.filter(o => o.status === 'DRAFT').length;
  const confirmedCount = orders.filter(o => o.status === 'CONFIRMED').length;
  const fullyReceivedCount = orders.filter(o => o.status === 'FULLY_RECEIVED').length;
  const cancelledCount = orders.filter(o => o.status === 'CANCELLED').length;

  const stats = [
    { id: 'total', label: 'Total Orders', value: totalOrders },
    { id: 'draft', label: 'Draft', value: draftCount, valueClassName: 'text-muted-foreground' },
    { id: 'confirmed', label: 'Confirmed', value: confirmedCount, valueClassName: 'text-blue-600' },
    { id: 'received', label: 'Fully Received', value: fullyReceivedCount, valueClassName: 'text-green-600' },
    { id: 'cancelled', label: 'Cancelled', value: cancelledCount, valueClassName: 'text-red-600' },
  ];

  return <StatsCards stats={stats} />;
}