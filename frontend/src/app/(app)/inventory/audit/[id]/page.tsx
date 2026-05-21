"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuditLogDetail } from "@/hooks/useAuditLogs";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Calendar, Globe, FileText } from "lucide-react";

export default function AuditLogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: log, isLoading, error } = useAuditLogDetail(params.id as string);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error || !log) return <div className="p-6 text-red-500">Failed to load audit log</div>;

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATE": return "bg-green-100 text-green-800";
      case "UPDATE": return "bg-blue-100 text-blue-800";
      case "DELETE": return "bg-red-100 text-red-800";
      default: return "bg-gray-100";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Audit Log Details</h1>
      </div>

      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">
                {log.action_display} on <span className="font-mono">{log.entity_type}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
              </p>
            </div>
            <Badge className={getActionColor(log.action)}>{log.action_display}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">User:</span>
              <span>{log.user_name || `User #${log.user_id}`}</span>
              {log.user_email && <span className="text-xs text-muted-foreground">({log.user_email})</span>}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Timestamp:</span>
              <span>{format(new Date(log.created_at), "PPPpp")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">IP Address:</span>
              <span className="font-mono">{log.ip_address || "N/A"}</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">User Agent:</span>
              <span className="text-xs text-muted-foreground truncate">{log.user_agent || "N/A"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Field Changes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Field Changes</CardTitle>
        </CardHeader>
        <CardContent>
          {log.field_changes.length === 0 ? (
            <p className="text-muted-foreground">No field changes recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.field_changes.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell className="font-medium">{change.field_name}</TableCell>
                    <TableCell className="font-mono text-xs break-all">
                      {change.old_value === null ? "<empty>" : change.old_value}
                    </TableCell>
                    <TableCell className="font-mono text-xs break-all">
                      {change.new_value === null ? "<empty>" : change.new_value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Additional metadata */}
      <Card>
        <CardHeader>
          <CardTitle>System Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Source Module:</span>
            <span>{log.source_module}</span>
            <span className="text-muted-foreground">Company ID / Branch ID:</span>
            <span>{log.company_id} / {log.branch_id}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}