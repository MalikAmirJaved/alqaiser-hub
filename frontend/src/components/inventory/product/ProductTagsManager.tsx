// src/components/inventory/product/ProductTagsManager.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Search, Tag as TagIcon, Hash, Sparkles } from "lucide-react";
import { ls, uid } from "@/services/localStorageService";

interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
  description?: string;
  is_active: string;
}

interface ProductTagsManagerProps {
  product: any;
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
}

export default function ProductTagsManager({ product, tags, onChange }: ProductTagsManagerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  useEffect(() => {
    const tagsList = ls.get("tags", []);
    setAllTags(tagsList);
    
    // Generate suggested tags from product name
    if (product.name) {
      const words = product.name.toLowerCase().split(/\s+/);
      const suggestions = words.filter(w => w.length > 3 && !tags.some(t => t.name.toLowerCase() === w));
      setSuggestedTags(suggestions.slice(0, 5));
    }
  }, [product.name, tags]);

  const handleAddTag = (tag: Tag) => {
    if (!tags.find(t => t.id === tag.id)) {
      onChange([...tags, tag]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(tags.filter(t => t.id !== tagId));
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    
    const slug = newTagName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const newTag: Tag = {
      id: uid("tag"),
      name: newTagName.trim(),
      slug,
      color: newTagColor,
      is_active: "true",
      created_at: new Date().toISOString(),
      created_by: ls.get("session")?.id
    };
    
    const updatedTags = [...allTags, newTag];
    ls.set("tags", updatedTags);
    setAllTags(updatedTags);
    onChange([...tags, newTag]);
    setNewTagName("");
    setNewTagColor("#3b82f6");
    setShowCreateTag(false);
  };

  const handleCreateAndAddSuggested = (suggestion: string) => {
    const slug = suggestion.toLowerCase().replace(/\s+/g, "-");
    const newTag: Tag = {
      id: uid("tag"),
      name: suggestion,
      slug,
      color: "#10b981",
      is_active: "true",
      created_at: new Date().toISOString(),
      created_by: ls.get("session")?.id
    };
    
    const updatedTags = [...allTags, newTag];
    ls.set("tags", updatedTags);
    setAllTags(updatedTags);
    onChange([...tags, newTag]);
  };

  const filteredTags = allTags.filter(tag => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !tags.find(t => t.id === tag.id)
  );

  const getTagColorClass = (color?: string) => {
    if (!color) return "bg-muted/40";
    // Return tailwind-like color class or inline style
    return `bg-[${color}]/10 text-[${color}]`;
  };

  return (
    <div className="space-y-6">
      {/* Current Tags */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Current Tags</h3>
            <div className="text-sm text-muted-foreground">
              <Hash className="w-3 h-3 inline mr-1" />
              {tags.length} tag(s)
            </div>
          </div>
          
          {tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
              <TagIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No tags assigned yet</p>
              <p className="text-sm">Use tags to categorize products for filtering and search</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge
                  key={tag.id}
                  style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined, borderColor: tag.color }}
                  className="px-3 py-1.5 text-sm gap-2 hover:bg-muted transition-colors"
                >
                  <TagIcon className="w-3 h-3" style={{ color: tag.color }} />
                  {tag.name}
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    className="hover:text-destructive transition-colors ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggested Tags from Product Name */}
      {suggestedTags.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Suggested Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleCreateAndAddSuggested(suggestion)}
                  className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> {suggestion}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Tags */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Add Tags</h3>
          
          <div className="space-y-4">
            {/* Search Existing Tags */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search existing tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Search Results */}
            {searchQuery && filteredTags.length > 0 && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                {filteredTags.slice(0, 10).map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <TagIcon className="w-3 h-3 text-muted-foreground" />
                      <span>{tag.name}</span>
                      {tag.description && (
                        <span className="text-xs text-muted-foreground">- {tag.description}</span>
                      )}
                    </div>
                    <Plus className="w-4 h-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
            
            {searchQuery && filteredTags.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <p>No tags found matching "{searchQuery}"</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setNewTagName(searchQuery);
                    setShowCreateTag(true);
                    setSearchQuery("");
                  }}
                  className="mt-1"
                >
                  Create "{searchQuery}" as a new tag
                </Button>
              </div>
            )}
            
            {/* Create New Tag Button */}
            {!showCreateTag && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreateTag(true)}
              >
                <Plus className="w-4 h-4 mr-2" /> Create New Tag
              </Button>
            )}
            
            {/* Create Tag Form */}
            {showCreateTag && (
              <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/5">
                <h4 className="text-sm font-medium">Create New Tag</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tag Name</Label>
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="e.g., Best Seller"
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tag Color</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="color"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        className="w-12 h-9 p-1"
                      />
                      <Input
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        className="flex-1"
                        placeholder="#HEX"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
                    Create Tag
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateTag(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Popular Tags */}
      {allTags.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-medium mb-2">Popular Tags in System</h3>
            <div className="flex flex-wrap gap-2">
              {allTags.slice(0, 12).map(tag => (
                <button
                  key={tag.id}
                  onClick={() => !tags.find(t => t.id === tag.id) && handleAddTag(tag)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    tags.find(t => t.id === tag.id)
                      ? "bg-primary/20 text-primary cursor-default"
                      : "bg-muted/40 hover:bg-primary/20 hover:text-primary"
                  }`}
                  disabled={!!tags.find(t => t.id === tag.id)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <div className="bg-info/10 border border-info/20 rounded-lg p-3 text-sm">
        <p className="text-info-foreground">
          🏷️ <strong>Tag Best Practices:</strong> Use tags for product categorization beyond categories. 
          Examples: "Best Seller", "New Arrival", "Limited Edition", "Eco-Friendly", "Summer Sale".
          Tags help customers find products through search and filters.
        </p>
      </div>
    </div>
  );
}