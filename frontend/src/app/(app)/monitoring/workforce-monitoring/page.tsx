

"use client";

import dynamic from "next/dynamic";
const MonitoringView = dynamic(() => import("@/components/monitoring/MonitoringView"), { ssr: false });
import { gateFeeds } from "@/config/monitoringFeeds";

export default () =>  <>
<MonitoringView
      title="Office Gate Monitoring"
      subtitle="Live CCTV feeds at office entry, exit and reception"
      feeds={gateFeeds}
    />
</>;

