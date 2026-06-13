// src/components/inventory/product/ProductTagsManager.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Search, Tag as TagIcon, Sparkles } from "lucide-react";
import { Tag } from "@/hooks/useProducts";

interface ProductTagsManagerProps {
  product: any;
  tags: Tag[];
  allTags: Tag[];
  onChange: (tags: Tag[]) => void;
}

export default function ProductTagsManager({ product, tags, allTags, onChange }: ProductTagsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredTags = allTags.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !tags.find(selected => selected.id === t.id));

  const handleAddTag = (tag: Tag) => {
    if (!tags.find(t => t.id === tag.id)) onChange([...tags, tag]);
  };
  const handleRemoveTag = (tagId: string) => onChange(tags.filter(t => t.id !== tagId));

  const suggestedTags = product.name?.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !tags.some(t => t.name.toLowerCase() === w)).slice(0, 4) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-3"><h3 className="font-medium">Current Tags</h3><span className="text-sm text-muted-foreground">{tags.length} tag(s)</span></div>
          {tags.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg"><TagIcon className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No tags assigned</p></div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge key={tag.id} style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }} className="px-3 py-1.5 gap-2">
                  <TagIcon className="w-3 h-3" style={{ color: tag.color }} />{tag.name}
                  <button onClick={() => handleRemoveTag(tag.id)}><X className="w-3 h-3 hover:text-destructive" /></button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {suggestedTags.length > 0 && (
        <Card><CardContent className="pt-4"><h3 className="font-medium mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Suggested Tags</h3><div className="flex flex-wrap gap-2">{suggestedTags.map(s => (<button key={s} onClick={() => handleAddTag({ id: s, name: s, slug: s } as Tag)} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-md"><Plus className="w-3 h-3 inline" /> {s}</button>))}</div></CardContent></Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Add Tags</h3>
          <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Search tags..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
          {searchQuery && filteredTags.length > 0 && (
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {filteredTags.map(tag => (
                <button key={tag.id} onClick={() => handleAddTag(tag)} className="w-full flex justify-between px-3 py-2 hover:bg-muted/40"><span>{tag.name}</span><Plus className="w-4 h-4 text-primary" /></button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}