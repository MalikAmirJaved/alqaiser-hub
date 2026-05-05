

"use client";

import dynamic from "next/dynamic";
const MonitoringView = dynamic(() => import("@/components/monitoring/MonitoringView"), { ssr: false });
import { employeeFeeds } from "@/config/monitoringFeeds";
export default () =>  <>
    <MonitoringView
      title="Employee Monitoring"
      subtitle="Live CCTV feeds across employee work areas"
      feeds={employeeFeeds}
    />
</>;

