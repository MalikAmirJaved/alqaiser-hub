// ============================================
// FILE: src/components/inventory/CategoryTree.jsx
// ============================================

"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, Plus, Edit, Trash2 } from "lucide-react";

export default function CategoryTree({ 
  categories = [], 
  onSelect, 
  onEdit, 
  onDelete, 
  onAddChild,
  selectedId = null 
}) {
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Build hierarchical tree
  const buildTree = (parentId = null) => {
    return categories
      .filter(cat => cat.parent_id === parentId)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map(cat => ({
        ...cat,
        children: buildTree(cat.id)
      }));
  };

  const tree = buildTree();

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const renderCategory = (category, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedIds.has(category.id);
    const isSelected = selectedId === category.id;

    return (
      <div key={category.id}>
        <div
          className={`flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition ${
            isSelected ? "bg-primary/10 border-l-2 border-primary" : ""
          }`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => onSelect?.(category)}
        >
          <div className="flex items-center gap-2 flex-1">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(category.id);
                }}
                className="p-0.5 hover:bg-muted rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}
            <Folder className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{category.name}</span>
            {category.status === "inactive" && (
              <span className="text-xs px-2 py-0.5 bg-muted rounded-full">Inactive</span>
            )}
            {category.show_in_menu === "true" && (
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                In Menu
              </span>
            )}
          </div>
          
          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddChild?.(category);
              }}
              className="p-1.5 hover:bg-muted rounded"
              title="Add Subcategory"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(category);
              }}
              className="p-1.5 hover:bg-muted rounded"
              title="Edit"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(category);
              }}
              className="p-1.5 hover:bg-destructive/10 text-destructive rounded"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {category.children.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {tree.map(category => renderCategory(category, 0))}
      {categories.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No categories created yet</p>
          <p className="text-xs">Click "Add Category" to get started</p>
        </div>
      )}
    </div>
  );
}