// src/hooks/useShifts.ts (UPDATED)
import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import { ShiftTemplate, ShiftAssignment } from "@/types/shifts";

export const useShifts = () => {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);

  // Initialize from LocalStorage
  useEffect(() => {
    setTemplates(ls.get("shifts_templates", []));
    setAssignments(ls.get("shifts_assignments", []));
  }, []);

  const saveTemplate = (template: ShiftTemplate) => {
    const existing = ls.get("shifts_templates", []);
    const idx = existing.findIndex((t: ShiftTemplate) => t.id === template.id);
    
    let updated: ShiftTemplate[];
    if (idx >= 0) {
      updated = existing.map((t: ShiftTemplate) => 
        t.id === template.id ? template : t
      );
    } else {
      updated = [template, ...existing];
    }
    
    setTemplates(updated);
    ls.set("shifts_templates", updated);
  };

  const saveAssignment = (assignment: ShiftAssignment) => {
    const existing = ls.get("shifts_assignments", []);
    const idx = existing.findIndex((a: ShiftAssignment) => a.id === assignment.id);
    
    let updated: ShiftAssignment[];
    if (idx >= 0) {
      updated = existing.map((a: ShiftAssignment) => 
        a.id === assignment.id ? assignment : a
      );
    } else {
      updated = [assignment, ...existing];
    }
    
    setAssignments(updated);
    ls.set("shifts_assignments", updated);
  };

  const deleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    ls.set("shifts_templates", updated);
  };

  const deleteAssignment = (id: string) => {
    const updated = assignments.filter(a => a.id !== id);
    setAssignments(updated);
    ls.set("shifts_assignments", updated);
  };

  return { 
    templates, 
    assignments, 
    saveTemplate, 
    saveAssignment, 
    deleteTemplate,
    deleteAssignment 
  };
};