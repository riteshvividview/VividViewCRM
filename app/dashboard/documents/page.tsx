"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Clock, LayoutTemplate } from "lucide-react";

import { DocIcon } from "@/modules/documents/components/doc-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { useDocuments } from "@/modules/documents/hooks/use-documents";
import { DOCUMENT_TEMPLATES } from "@/modules/documents/types";
import { formatDate, cn } from "@/lib/utils";
import type { Document } from "@/modules/documents/types";

export default function DocumentsPage() {
  const router = useRouter();
  const { documents, loading, createDocument } = useDocuments();
  const [search, setSearch] = useState("");
  const [creatingFromTemplate, setCreatingFromTemplate] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, search]);

  async function handleNew() {
    const doc = await createDocument({ title: "Untitled", icon: "File" });
    router.push(`/dashboard/documents/${doc.id}`);
  }

  async function handleFromTemplate(idx: number) {
    const tpl = DOCUMENT_TEMPLATES[idx];
    if (!tpl) return;
    setCreatingFromTemplate(tpl.template_type ?? "");
    const doc = await createDocument({
      title: tpl.title,
      icon: tpl.icon,
      blocks: tpl.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
      template_type: tpl.template_type,
    });
    setCreatingFromTemplate(null);
    router.push(`/dashboard/documents/${doc.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Notion-style workspace"
        action={
          <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5" />New Document
          </Button>
        }
      />

      {/* Templates */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutTemplate className="h-3.5 w-3.5" />Templates
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DOCUMENT_TEMPLATES.map((tpl, i) => (
            <button
              key={tpl.template_type}
              onClick={() => handleFromTemplate(i)}
              disabled={creatingFromTemplate !== null}
              className={cn(
                "group relative text-left bg-card border border-border rounded-xl p-4 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm transition-all disabled:opacity-50",
                creatingFromTemplate === tpl.template_type && "border-purple-400 shadow-sm"
              )}
            >
              <div className="mb-2"><DocIcon name={tpl.icon} className="h-6 w-6 text-purple-600" /></div>
              <p className="text-sm font-medium text-foreground">{tpl.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tpl.blocks.length} blocks</p>
              <div className="absolute inset-0 rounded-xl bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </section>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9 h-9 text-sm" placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Recent documents */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />Recent
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} onClick={() => router.push(`/dashboard/documents/${doc.id}`)} />
            ))}
            {filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {search ? "No documents match your search" : "No documents yet — create one above"}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DocumentRow({ doc, onClick }: { doc: Document; onClick: () => void }) {
  const preview = doc.blocks
    .filter((b) => b.type === "paragraph" && b.content)
    .slice(0, 1)
    .map((b) => b.content)
    .join("");

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors border border-transparent hover:border-border"
    >
      <DocIcon name={doc.icon} className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
          {doc.title || "Untitled"}
        </p>
        {preview && <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{formatDate(doc.updated_at)}</span>
    </div>
  );
}
