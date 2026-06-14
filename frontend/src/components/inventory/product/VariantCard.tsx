// src/components/inventory/product/VariantCard.tsx
"use client";

import { useState } from "react";
import {
  Layers,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  X,
  RotateCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import FormField from "@/components/reuseable/FormField";
import AttributeSelector from "./Attributeselector";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAutoCode } from "@/hooks/useAutoCode";
import { toast } from "sonner";

interface VariantCardStandaloneProps {
  standalone: true;
  onSubmit: (data: VariantFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

interface VariantCardFieldArrayProps {
  index: number;
  control: any;
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  isEditing: boolean;
  onRemove: () => void;
  onDuplicate: () => void;
}

export type VariantFormData = {
  sku: string;
  variantTitle: string;
  barcode: string;
  sellingPrice: number;
  minStockLevel: number;
  maxStockLevel: number;
  attributes: { key: string; value: string }[];
  images: string[];
};

type VariantCardProps = VariantCardStandaloneProps | VariantCardFieldArrayProps;

function InternalVariantCard({
  index,
  control,
  register,
  errors,
  watch,
  setValue,
  isEditing,
  onRemove,
  onDuplicate,
  standalone,
}: VariantCardFieldArrayProps & { standalone?: boolean }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [imgUrl, setImgUrl] = useState("");
  const [addingImg, setAddingImg] = useState(false);
  const { CurrencyCode } = useCompanySettings();
  const { generateCode, validateCode } = useAutoCode("product_variant");

  const images: string[] = watch(`variants.${index}.images`) || [];
  const sku: string = watch(`variants.${index}.sku`) || `Variant ${index + 1}`;
  const variantTitle: string = watch(`variants.${index}.variantTitle`) || "";
  const attrs: { key: string; value: string }[] = watch(`variants.${index}.attributes`) || [];

  const displayName =
    variantTitle || (attrs.length > 0 ? attrs.map((a) => `${a.key}: ${a.value}`).join(" · ") : sku);

  const addImage = () => {
    if (!imgUrl.trim()) return;
    setValue(`variants.${index}.images`, [...images, imgUrl.trim()]);
    setImgUrl("");
    setAddingImg(false);
  };

  const removeImage = (i: number) => {
    setValue(
      `variants.${index}.images`,
      images.filter((_, idx) => idx !== i),
    );
  };

  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-all ${expanded ? "border-primary/40 shadow-sm" : "border-border"}`}
    >
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground font-mono">Variant #{index + 1}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!standalone && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Duplicate"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-6 border-t border-border/60">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-3">
              Identification
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="SKU" required error={errors?.variants?.[index]?.sku?.message}>
                <div className="flex gap-2">
                  <Input
                    {...register(`variants.${index}.sku`)}
                    onChange={(e) => {
                      const el = e.target;
                      el.value = el.value.toUpperCase();
                      register(`variants.${index}.sku`).onChange(e);
                    }}
                    onBlur={(e) => validateCode(e.target.value)}
                    placeholder="e.g. PROD-RED-M"
                    className="font-mono text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => generateCode().then(code => setValue(`variants.${index}.sku`, code)).catch(() => {})}
                    className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-muted transition flex-shrink-0"
                    title="Generate new code"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </FormField>
              <FormField label="Variant Title">
                <Input
                  {...register(`variants.${index}.variantTitle`)}
                  placeholder="e.g. Red Medium"
                />
              </FormField>
              <FormField label="Barcode">
                <Input {...register(`variants.${index}.barcode`)} placeholder="Optional" />
              </FormField>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Pricing & Stock
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField
                label="Selling Price"
                required
                error={errors?.variants?.[index]?.sellingPrice?.message}
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {CurrencyCode()}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`variants.${index}.sellingPrice`)}
                    placeholder="0.00"
                    className="pl-12"
                  />
                </div>
              </FormField>
              <FormField label="Min Stock">
                <Input
                  type="number"
                  min="0"
                  {...register(`variants.${index}.minStockLevel`)}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Max Stock">
                <Input
                  type="number"
                  min="0"
                  {...register(`variants.${index}.maxStockLevel`)}
                  placeholder="0"
                />
              </FormField>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Attributes
            </p>
            <Controller
              control={control}
              name={`variants.${index}.attributes`}
              render={({ field }) => (
                <AttributeSelector attributes={field.value || []} onChange={field.onChange} />
              )}
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Images
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              {images.map((url, i) => (
                <div
                  key={i}
                  className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
              {addingImg ? (
                <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                  <Input
                    autoFocus
                    placeholder="https://example.com/image.jpg"
                    value={imgUrl}
                    onChange={(e) => setImgUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImage())}
                    className="flex-1 text-sm"
                  />
                  <Button type="button" size="sm" onClick={addImage}>
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setAddingImg(false); setImgUrl(""); }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingImg(true)}
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[10px] font-medium">Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VariantCard(props: VariantCardProps) {
  const { standalone } = props as any;

  if (!standalone) {
    const p = props as VariantCardFieldArrayProps;
    return <InternalVariantCard {...p} standalone={false} />;
  }

  // ── Standalone mode ──
  return <StandaloneVariantCard {...(props as VariantCardStandaloneProps)} />;
}

function StandaloneVariantCard({
  onSubmit,
  onCancel,
  loading,
}: VariantCardStandaloneProps) {
  const { CurrencyCode } = useCompanySettings();
  const { generateCode, validateCode } = useAutoCode("product_variant");

  const {
    register,
    control,
    handleSubmit: formHandleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      variants: [{
        sku: "",
        variantTitle: "",
        barcode: "",
        sellingPrice: 0,
        minStockLevel: 0,
        maxStockLevel: 0,
        attributes: [] as { key: string; value: string }[],
        images: [] as string[],
      }],
    },
  });

  const { fields } = useFieldArray({ control, name: "variants" });

  const onFormSubmit = async (data: any) => {
    const v = data.variants[0];
    if (!v.sku.trim()) {
      toast.error("SKU is required.");
      return;
    }
    if (v.sellingPrice <= 0) {
      toast.error("Selling price must be greater than 0.");
      return;
    }
    await onSubmit(v);
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
        <div>
          <h3 className="text-base font-medium">New Variant</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={formHandleSubmit(onFormSubmit)}>
        <div className="space-y-3">
          {fields.map((field, i) => (
            <InternalVariantCard
              key={field.id}
              index={i}
              control={control}
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue}
              isEditing={false}
              onRemove={() => {}}
              onDuplicate={() => {}}
              standalone
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-85 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating…" : "Create Variant"}
          </button>
        </div>
      </form>
    </div>
  );
}
