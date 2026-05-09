"use client";

import { useState } from "react";
import { User, Mail, Phone, Building2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidePanel } from "@/components/shared/side-panel";
import type { Contact } from "../types";

interface ContactSidePanelProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Contact>) => void;
}

export function ContactSidePanel({ open, onClose, onSave }: ContactSidePanelProps) {
  const [form, setForm] = useState<Partial<Contact>>({ status: "Active", tags: [] });
  const [tagInput, setTagInput] = useState("");

  function set(key: keyof Contact, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !(form.tags ?? []).includes(t)) {
      set("tags", [...(form.tags ?? []), t]);
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    set("tags", (form.tags ?? []).filter((t) => t !== tag));
  }

  function handleSave() {
    if (!form.full_name?.trim() || !form.email?.trim()) return;
    onSave(form);
    setForm({ status: "Active", tags: [] });
    onClose();
  }

  return (
    <SidePanel open={open} onClose={onClose} title="New Contact">
      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Full Name *</Label>
          <div className="relative">
            <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Priya Sharma"
              value={form.full_name ?? ""}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label className="text-xs">Email *</Label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="priya@company.com"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="+91 98765 43210"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs">Job Title</Label>
          <Input
            className="h-9 text-sm"
            placeholder="VP of Sales"
            value={form.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>

        {/* Company */}
        <div className="space-y-1.5">
          <Label className="text-xs">Company</Label>
          <div className="relative">
            <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="TechFlow Inc."
              value={form.company_name ?? ""}
              onChange={(e) => set("company_name", e.target.value)}
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={form.status ?? "Active"} onValueChange={(v) => set("status", v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label className="text-xs">Tags</Label>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Tag className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Add tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              />
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={addTag}>Add</Button>
          </div>
          {(form.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(form.tags ?? []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-purple-900 dark:hover:text-purple-100">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 flex gap-2">
          <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSave} disabled={!form.full_name?.trim() || !form.email?.trim()}>
            Create Contact
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </SidePanel>
  );
}
