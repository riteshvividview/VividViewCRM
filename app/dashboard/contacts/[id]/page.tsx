"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, Phone, Building2, Calendar, MoreHorizontal,
  Pencil, Check, X, Upload, Camera,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContacts, MOCK_ACTIVITIES } from "@/modules/contacts/hooks/use-contacts";
import { ContactActivityFeed } from "@/modules/contacts/components/contact-activity";
import { CustomFieldsEditor } from "@/modules/contacts/components/custom-fields-editor";
import { FileDropZone } from "@/components/shared/file-drop-zone";
import { FileGrid } from "@/components/shared/file-grid";
import { BlockEditor } from "@/modules/documents/components/block-editor";
import { getInitials, formatDate, cn } from "@/lib/utils";
import type { Contact, ContactActivity, CustomField } from "@/modules/contacts/types";
import type { UploadedFile } from "@/components/shared/file-drop-zone";
import type { Block } from "@/modules/documents/types";

const STATUS_STYLE: Record<string, string> = {
  Active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Inactive: "bg-muted text-muted-foreground",
  Prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function EditableField({ label, value, onSave, type = "text" }: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  function commit() { onSave(draft); setEditing(false); }
  return (
    <div className="group flex items-center justify-between gap-2 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-muted-foreground w-28 shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1">
          <Input className="h-7 text-sm flex-1" type={type} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={commit}><Check className="h-3.5 w-3.5 text-emerald-500" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setDraft(value); setEditing(false); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-sm text-foreground flex-1 truncate">{value || <span className="text-muted-foreground/40">—</span>}</span>
          <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity" onClick={() => { setDraft(value); setEditing(true); }}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { contacts, updateContact } = useContacts();
  const [contact, setContact] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [noteBlocks, setNoteBlocks] = useState<Block[]>([{ id: crypto.randomUUID(), type: "paragraph", content: "" }]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    const c = contacts.find((c) => c.id === id);
    if (c) {
      setContact(c);
      setNameDraft(c.full_name);
    } else if (contacts.length === 0) {
      // loading: wait
    }
  }, [contacts, id]);

  useEffect(() => {
    // Load mock activities filtered to this contact
    setActivities(MOCK_ACTIVITIES.filter((a) => a.contact_id === id));
  }, [id]);

  function update(updates: Partial<Contact>) {
    if (!contact) return;
    const updated = { ...contact, ...updates };
    setContact(updated);
    updateContact(contact.id, updates);
  }

  function handleAddNote(content: string) {
    const act: ContactActivity = {
      id: crypto.randomUUID(),
      contact_id: id,
      type: "note",
      content,
      created_by: "You",
      created_at: new Date().toISOString(),
    };
    setActivities((a) => [act, ...a]);
    update({ last_activity_at: new Date().toISOString() });
  }

  function handleFileUpload(file: UploadedFile) {
    setFiles((f) => [file, ...f]);
  }

  function handleFileDelete(fileId: string) {
    setFiles((f) => f.filter((ff) => ff.id !== fileId));
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back nav */}
      <button
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        onClick={() => router.push("/dashboard/contacts")}
      >
        <ArrowLeft className="h-4 w-4" />Back to Contacts
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: Profile card */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            {/* Avatar + name */}
            <div className="flex flex-col items-center text-center gap-2 pb-4 border-b border-border">
              <div className="relative group">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={contact.avatar_url ?? undefined} />
                  <AvatarFallback className="text-2xl font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                    {getInitials(contact.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>

              {editingName ? (
                <div className="flex items-center gap-1 w-full">
                  <Input
                    className="h-8 text-sm text-center font-semibold"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { update({ full_name: nameDraft }); setEditingName(false); }
                      if (e.key === "Escape") { setNameDraft(contact.full_name); setEditingName(false); }
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { update({ full_name: nameDraft }); setEditingName(false); }}>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  </Button>
                </div>
              ) : (
                <button className="group/name flex items-center gap-1" onClick={() => { setNameDraft(contact.full_name); setEditingName(true); }}>
                  <h1 className="text-lg font-bold text-foreground">{contact.full_name}</h1>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
                </button>
              )}

              <p className="text-sm text-muted-foreground">{[contact.title, contact.company_name].filter(Boolean).join(" · ")}</p>
              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", STATUS_STYLE[contact.status])}>
                {contact.status}
              </span>
            </div>

            {/* Quick contact */}
            <div className="space-y-1 pt-4">
              <EditableField label="Email" value={contact.email ?? ""} onSave={(v) => update({ email: v })} type="email" />
              <EditableField label="Phone" value={contact.phone ?? ""} onSave={(v) => update({ phone: v })} />
              <EditableField label="Title" value={contact.title ?? ""} onSave={(v) => update({ title: v })} />
              <EditableField label="Company" value={contact.company_name ?? ""} onSave={(v) => update({ company_name: v })} />
            </div>

            {/* Status */}
            <div className="pt-3">
              <Select value={contact.status} onValueChange={(v) => update({ status: v as Contact["status"] })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          {(contact.tags ?? []).length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meta</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Created</span><span>{formatDate(contact.created_at)}</span></div>
              <div className="flex justify-between"><span>Last activity</span><span>{contact.last_activity_at ? formatDate(contact.last_activity_at) : "—"}</span></div>
              {contact.owner_name && <div className="flex justify-between"><span>Owner</span><span className="text-foreground font-medium">{contact.owner_name}</span></div>}
            </div>
          </div>
        </div>

        {/* Right: Tabs */}
        <div>
          <Tabs defaultValue="overview">
            <TabsList className="mb-4 bg-muted/50">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="custom">Custom Fields</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Contact Details</h3>
                <div className="space-y-0">
                  <EditableField label="Full Name" value={contact.full_name} onSave={(v) => update({ full_name: v })} />
                  <EditableField label="Email" value={contact.email ?? ""} onSave={(v) => update({ email: v })} type="email" />
                  <EditableField label="Phone" value={contact.phone ?? ""} onSave={(v) => update({ phone: v })} />
                  <EditableField label="Job Title" value={contact.title ?? ""} onSave={(v) => update({ title: v })} />
                  <EditableField label="Company" value={contact.company_name ?? ""} onSave={(v) => update({ company_name: v })} />
                </div>
              </div>
            </TabsContent>

            {/* Activity */}
            <TabsContent value="activity">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Activity Timeline</h3>
                <ContactActivityFeed activities={activities} onAddNote={handleAddNote} />
              </div>
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Notes</h3>
                <BlockEditor
                  blocks={noteBlocks}
                  onChange={setNoteBlocks}
                />
              </div>
            </TabsContent>

            {/* Files */}
            <TabsContent value="files">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
                <FileDropZone
                  entityType="contact"
                  entityId={id}
                  onUpload={handleFileUpload}
                  compact
                />
                <FileGrid files={files} onDelete={handleFileDelete} />
              </div>
            </TabsContent>

            {/* Custom Fields */}
            <TabsContent value="custom">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Custom Fields</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Add your own fields to store extra information</p>
                </div>
                <CustomFieldsEditor
                  fields={contact.custom_fields ?? []}
                  onChange={(fields) => update({ custom_fields: fields })}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
