"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomField } from "../types";
import { cn } from "@/lib/utils";

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  readOnly?: boolean;
}

function FieldValue({ field, onChange }: { field: CustomField; onChange: (val: unknown) => void }) {
  if (field.type === "select" && field.options) {
    return (
      <Select value={String(field.value ?? "")} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "multiselect" && field.options) {
    const vals: string[] = Array.isArray(field.value) ? field.value as string[] : [];
    return (
      <div className="flex flex-wrap gap-1">
        {field.options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(vals.includes(o) ? vals.filter((v) => v !== o) : [...vals, o])}
            className={cn("px-2 py-0.5 rounded-full text-xs border transition-colors", vals.includes(o) ? "bg-purple-600 text-white border-purple-600" : "bg-background border-border text-muted-foreground hover:border-purple-400")}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }
  return (
    <Input
      className="h-8 text-sm"
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
      value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
      onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
      placeholder={`Enter ${field.label.toLowerCase()}…`}
    />
  );
}

export function CustomFieldsEditor({ fields, onChange, readOnly = false }: CustomFieldsEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newField, setNewField] = useState<Partial<CustomField>>({ type: "text" });

  function updateValue(id: string, value: unknown) {
    onChange(fields.map((f) => f.id === id ? { ...f, value: value as string | string[] | null } : f));
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function addField() {
    if (!newField.label?.trim()) return;
    onChange([...fields, {
      id: crypto.randomUUID(),
      label: newField.label.trim(),
      type: newField.type ?? "text",
      value: null as string | null,
      options: newField.options,
    }]);
    setNewField({ type: "text" });
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.id} className="group flex items-start gap-2">
          <div className="flex-1 grid grid-cols-[140px_1fr] gap-2 items-start">
            <span className="text-xs font-medium text-muted-foreground pt-1.5 truncate">{f.label}</span>
            {readOnly
              ? <span className="text-sm text-foreground py-1">{Array.isArray(f.value) ? (f.value as string[]).join(", ") : String(f.value ?? "—")}</span>
              : <FieldValue field={f} onChange={(v) => updateValue(f.id, v)} />
            }
          </div>
          {!readOnly && (
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" onClick={() => removeField(f.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ))}

      {!readOnly && (
        adding ? (
          <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="h-8 text-sm"
                placeholder="Field label"
                value={newField.label ?? ""}
                onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))}
                autoFocus
              />
              <Select value={newField.type ?? "text"} onValueChange={(v) => setNewField((p) => ({ ...p, type: v as CustomField["type"] }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["text", "number", "date", "url", "email", "select", "multiselect"].map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(newField.type === "select" || newField.type === "multiselect") && (
              <Input
                className="h-8 text-sm"
                placeholder="Options (comma-separated)"
                onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={addField} disabled={!newField.label?.trim()}>Add field</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewField({ type: "text" }); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />Add field
          </Button>
        )
      )}
    </div>
  );
}
