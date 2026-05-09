"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, LayoutGrid, Table2, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ContactsTable } from "@/modules/contacts/components/contacts-table";
import { ContactSidePanel } from "@/modules/contacts/components/contact-side-panel";
import { useContacts } from "@/modules/contacts/hooks/use-contacts";
import { getInitials, cn } from "@/lib/utils";
import type { Contact } from "@/modules/contacts/types";

const STATUS_STYLE: Record<string, string> = {
  Active:   "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  Inactive: "bg-muted text-muted-foreground",
  Prospect: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
};

type ViewMode = "table" | "grid";

export default function ContactsPage() {
  const router = useRouter();
  const { contacts, loading, addContact, deleteContact } = useContacts();
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.company_name ?? "").toLowerCase().includes(q) ||
      (c.title ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  async function handleAddContact(data: Partial<Contact>) {
    await addContact({
      full_name: data.full_name ?? "Unnamed",
      email: data.email ?? null,
      phone: data.phone ?? null,
      title: data.title ?? null,
      company_id: null,
      company_name: data.company_name ?? null,
      avatar_url: null,
      status: data.status ?? "Active",
      tags: data.tags ?? [],
      owner: null,
      owner_name: null,
      last_activity_at: new Date().toISOString(),
      custom_fields: [],
      notes_content: null,
      workspace_id: null,
    });
  }

  function handleDeleteSelected() {
    selectedIds.forEach((id) => deleteContact(id));
    setSelectedIds([]);
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`}
        action={
          <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setPanelOpen(true)}>
            <Plus className="h-3.5 w-3.5" />New Contact
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteSelected}>
              <Trash2 className="h-3.5 w-3.5" />Delete {selectedIds.length}
            </Button>
          )}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              className={cn("px-2.5 py-1.5 transition-colors", view === "table" ? "bg-muted" : "hover:bg-muted/50")}
              onClick={() => setView("table")}
            >
              <Table2 className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              className={cn("px-2.5 py-1.5 transition-colors", view === "grid" ? "bg-muted" : "hover:bg-muted/50")}
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      ) : view === "table" ? (
        <ContactsTable
          contacts={filtered}
          onView={(id) => router.push(`/dashboard/contacts/${id}`)}
          onDelete={deleteContact}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          globalFilter={search}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer group"
              onClick={() => router.push(`/dashboard/contacts/${c.id}`)}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={c.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-sm font-semibold">
                    {getInitials(c.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{[c.title, c.company_name].filter(Boolean).join(" · ")}</p>
                </div>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", STATUS_STYLE[c.status] ?? "bg-muted text-muted-foreground")}>
                  {c.status}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
                {c.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    {c.email}
                  </p>
                )}
                {c.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    {c.phone}
                  </p>
                )}
                {(c.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {c.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">No contacts found</div>
          )}
        </div>
      )}

      <ContactSidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSave={handleAddContact}
      />
    </div>
  );
}
