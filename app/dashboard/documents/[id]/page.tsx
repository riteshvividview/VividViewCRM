"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlockEditor } from "@/modules/documents/components/block-editor";
import { useDocuments } from "@/modules/documents/hooks/use-documents";
import type { Block } from "@/modules/documents/types";

type SaveState = "saved" | "saving" | "unsaved";

const EMOJI_OPTIONS = ["📄", "📝", "📊", "🤝", "✅", "💡", "🗒️", "📋", "🔗", "🎯", "📌", "⚡"];

export default function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { documents, saveDocument, deleteDocument } = useDocuments();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📄");
  const [blocks, setBlocks] = useState<Block[]>([{ id: crypto.randomUUID(), type: "paragraph", content: "" }]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load document from hook state
  useEffect(() => {
    const doc = documents.find((d) => d.id === id);
    if (doc && !loaded) {
      setTitle(doc.title);
      setIcon(doc.icon ?? "📄");
      if (doc.blocks.length > 0) setBlocks(doc.blocks);
      setLoaded(true);
    }
  }, [documents, id, loaded]);

  const scheduleSave = useCallback((newTitle: string, newBlocks: Block[], newIcon: string) => {
    setSaveState("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      await saveDocument(id, { title: newTitle, blocks: newBlocks, icon: newIcon });
      setSaveState("saved");
    }, 1200);
  }, [id, saveDocument]);

  function handleTitleChange(val: string) {
    setTitle(val);
    scheduleSave(val, blocks, icon);
  }

  function handleBlocksChange(newBlocks: Block[]) {
    setBlocks(newBlocks);
    scheduleSave(title, newBlocks, icon);
  }

  function handleIconChange(e: string) {
    setIcon(e);
    setShowEmojiPicker(false);
    scheduleSave(title, blocks, e);
  }

  async function handleDelete() {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(id);
    router.push("/dashboard/documents");
  }

  if (!loaded && documents.length > 0 && !documents.find((d) => d.id === id)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Document not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/documents")}>
          Back to Documents
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8 gap-3">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          onClick={() => router.push("/dashboard/documents")}
        >
          <ArrowLeft className="h-4 w-4" />Documents
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {/* Save indicator */}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveState === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>}
            {saveState === "saved" && <><Check className="h-3.5 w-3.5 text-emerald-500" />Saved</>}
            {saveState === "unsaved" && <span className="text-amber-500">Unsaved</span>}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document header */}
      <div className="mb-6">
        {/* Icon picker */}
        <div className="relative mb-3">
          <button
            className="text-4xl hover:scale-110 transition-transform"
            onClick={() => setShowEmojiPicker((v) => !v)}
          >
            {icon}
          </button>
          {showEmojiPicker && (
            <div className="absolute top-12 left-0 z-20 bg-popover border border-border rounded-xl shadow-xl p-2 grid grid-cols-6 gap-1">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  className="text-xl p-1.5 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => handleIconChange(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Title */}
        <input
          className="w-full text-4xl font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 leading-tight"
          placeholder="Untitled"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
      </div>

      {/* Block editor */}
      <BlockEditor blocks={blocks} onChange={handleBlocksChange} />
    </div>
  );
}
