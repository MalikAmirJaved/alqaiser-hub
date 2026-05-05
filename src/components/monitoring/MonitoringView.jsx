// @/components/monitoring/MonitoringView.tsx
"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Circle, Maximize2, Video } from "lucide-react";

export default function MonitoringView({ title, subtitle, feeds }) {
  const [active, setActive] = useState(feeds[0]);

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden bg-black border-border">
          <div className="relative aspect-video">
            <video
              key={active.id}
              src={active.src}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
              <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-white tracking-wider">LIVE</span>
            </div>
            <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
              <span className="text-xs text-white font-mono">{new Date().toLocaleString()}</span>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">{active.name}</div>
                <div className="text-xs text-white/70">{active.location}</div>
              </div>
              <Button size="sm" variant="secondary">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Camera Feeds ({feeds.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {feeds.map((f) => (
              <Card
                key={f.id}
                onClick={() => setActive(f)}
                className={`overflow-hidden cursor-pointer transition-all ${
                  active.id === f.id ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border"
                }`}
              >
                <div className="relative aspect-video bg-black">
                  <video
                    src={f.src}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute top-1.5 left-1.5">
                    <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="text-xs font-medium text-white truncate">{f.name}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Cameras</div>
          <div className="text-2xl font-bold mt-1">{feeds.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Online</div>
          <div className="text-2xl font-bold mt-1 text-green-500">{feeds.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Offline</div>
          <div className="text-2xl font-bold mt-1 text-muted-foreground">0</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Recording</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Video className="h-5 w-5 text-red-500" /> 24/7
          </div>
        </Card>
      </div>
    </div>
  );
}
