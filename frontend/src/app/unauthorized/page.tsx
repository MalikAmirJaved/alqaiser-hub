"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md p-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground mt-2">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Please contact your administrator if you believe this is an error.
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
          <Button onClick={() => router.push("/dashboard")}>
            <Home className="w-4 h-4 mr-2" /> Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}