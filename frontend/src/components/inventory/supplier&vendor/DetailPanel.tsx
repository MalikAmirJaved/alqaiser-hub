import { X, Pencil, Trash2, Building2, Mail, Phone, MapPin, CreditCard, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DetailField {
  label: string;
  key: string | ((row: any) => string);
  formatter?: (value: any) => React.ReactNode;
}

interface DetailPanelProps {
  data: any;
  fields: DetailField[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const FieldIcon = ({ label }: { label: string }) => {
  const iconMap: Record<string, any> = {
    Email: Mail,
    Phone: Phone,
    Address: MapPin,
    Location: MapPin,
    "Credit Limit": CreditCard,
    "Current Balance": CreditCard,
    Rating: Star,
  };
  const Icon = iconMap[label];
  return Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null;
};

export function DetailPanel({ data, fields, onClose, onEdit, onDelete }: DetailPanelProps) {
  const getValue = (field: DetailField) => {
    let raw: any;
    if (typeof field.key === "function") {
      raw = field.key(data);
    } else {
      raw = data[field.key];
    }
    if (field.formatter) {
      return field.formatter(raw);
    }
    return raw || "—";
  };

  // Group fields into sections
  const mainInfo = fields.slice(0, 4);
  const contactInfo = fields.slice(4, 7);
  const financialInfo = fields.slice(7, 10);
  const metadata = fields.slice(10);

  return (
    <div className="w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-lg">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border p-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {data.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">ID: {data.code}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Main Info Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">General Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mainInfo.map((field, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FieldIcon label={field.label} />
                  {field.label}:
                </span>
                <span className="font-medium text-right max-w-[60%] break-words">
                  {getValue(field)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactInfo.map((field, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FieldIcon label={field.label} />
                  {field.label}:
                </span>
                <span className="text-right max-w-[60%] break-words">
                  {getValue(field)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Financial Information */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Financial Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {financialInfo.map((field, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FieldIcon label={field.label} />
                  {field.label}:
                </span>
                <span className="font-medium text-right">
                  {getValue(field)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metadata.map((field, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm">
                <span className="text-muted-foreground">{field.label}:</span>
                <span className="text-right text-xs text-muted-foreground">
                  {getValue(field)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons - Sticky at bottom */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 flex gap-3">
        <Button variant="outline" size="default" onClick={onEdit} className="flex-1">
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
        <Button variant="destructive" size="default" onClick={onDelete} className="flex-1">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  );
}