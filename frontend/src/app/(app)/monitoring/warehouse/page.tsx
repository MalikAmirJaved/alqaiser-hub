

"use client";

import dynamic from "next/dynamic";
const MonitoringView = dynamic(() => import("@/components/monitoring/MonitoringView"), { ssr: false });
import { warehouseFeeds } from "@/config/monitoringFeeds";

export default () =>  <>
<MonitoringView
      title="Warehouse Monitoring"
      subtitle="Live CCTV feeds across warehouse zones"
      feeds={warehouseFeeds}
    />
</>;

