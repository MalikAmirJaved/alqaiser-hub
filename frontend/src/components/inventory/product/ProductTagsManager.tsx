// src/components/inventory/product/ProductTagsManager.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Search, Tag as TagIcon, Sparkles } from "lucide-react";
import { Label } from "recharts";

interface TagInputItem {
  name: string;
  group?: string;
}

interface ProductTagsManagerProps {
  product: any;
  tagInput: TagInputItem[];
  allTags: any[]; // existing tags from API (for suggestions)
  onChange: (tagInput: TagInputItem[]) => void;
}

export default function ProductTagsManager({ product, tagInput, allTags, onChange }: ProductTagsManagerProps) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagGroup, setNewTagGroup] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const addTag = (name: string, group?: string) => {
    name = name.trim();
    if (!name) return;
    if (tagInput.some(t => t.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...tagInput, { name, group: group?.trim() || undefined }]);
    setNewTagName("");
    setNewTagGroup("");
  };

  const removeTag = (index: number) => {
    onChange(tagInput.filter((_, i) => i !== index));
  };

  const suggestedTags = () => {
    // Suggest from product name words + existing tags not already added
    const words = product.name?.toLowerCase().split(/\s+/).filter(w => w.length > 3) || [];
    const existingNames = tagInput.map(t => t.name.toLowerCase());
    const suggestions = [...new Set([...words, ...allTags.map(t => t.name)])]
      .filter(name => !existingNames.includes(name.toLowerCase()))
      .slice(0, 5);
    return suggestions;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-3"><h3 className="font-medium">Product Tags</h3><span className="text-sm text-muted-foreground">{tagInput.length} tag(s)</span></div>
          {tagInput.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg"><TagIcon className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No tags assigned</p></div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagInput.map((tag, idx) => (
                <Badge key={idx} className="px-3 py-1.5 gap-2 bg-primary/10">
                  <TagIcon className="w-3 h-3" />
                  {tag.name}
                  {tag.group && <span className="text-xs text-muted-foreground">({tag.group})</span>}
                  <button onClick={() => removeTag(idx)}><X className="w-3 h-3 hover:text-destructive" /></button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {suggestedTags().length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-medium mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Suggested Tags</h3>
            <div className="flex flex-wrap gap-2">
              {suggestedTags().map(s => (
                <button key={s} onClick={() => addTag(s)} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
                  <Plus className="w-3 h-3 inline mr-1" />{s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Add New Tag</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Tag name (e.g., Laptop)"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <Input
              placeholder="Group (optional, e.g., Product Type)"
              value={newTagGroup}
              onChange={(e) => setNewTagGroup(e.target.value)}
            />
            <Button onClick={() => addTag(newTagName, newTagGroup)} disabled={!newTagName}>
              <Plus className="w-4 h-4 mr-1" /> Add Tag
            </Button>
          </div>
          <div className="mt-4">
            <Label className="text-xs">Or select from existing tags:</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search existing tags..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            {searchQuery && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto mt-2">
                {allTags.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !tagInput.some(ct => ct.name.toLowerCase() === t.name.toLowerCase())).map(tag => (
                  <button key={tag.id} onClick={() => addTag(tag.name, tag.group?.name)} className="w-full flex justify-between px-3 py-2 hover:bg-muted/40">
                    <span>{tag.name}</span>
                    {tag.group && <span className="text-xs text-muted-foreground">{tag.group.name}</span>}
                    <Plus className="w-4 h-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}