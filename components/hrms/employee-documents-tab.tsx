"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  FileText, Image as ImageIcon, File, Upload, Download, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { UserRole } from "@/types";

interface DocumentEntry {
  id: string;
  document_type: string;
  document_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

const DOCUMENT_TYPES = [
  "Aadhaar Card", "PAN Card", "Passport", "Resume/CV", "Offer Letter",
  "Education Certificate", "Experience Letter", "Bank Proof", "Other",
];

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (["png", "jpg", "jpeg", "webp"].includes(ext ?? "")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-gray-400" />;
}

export function EmployeeDocumentsTab({
  employeeId,
  workspaceId,
  viewerRole,
}: {
  employeeId: string;
  workspaceId: string;
  viewerRole: UserRole;
}) {
  const isHR = viewerRole === "super_admin" || viewerRole === "hr";

  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [docName, setDocName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("hr_employee_documents")
      .select("id, document_type, document_name, file_path, file_size, created_at")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Documents fetch error:", error);
    }
    setDocuments((data ?? []) as unknown as DocumentEntry[]);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  async function handleFileSelected(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only PDF, JPEG, PNG, or WEBP files are allowed");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("File exceeds 5MB limit");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const path = `${workspaceId}/${employeeId}/${Date.now()}-${file.name}`;

    try {
      const { error: upErr } = await supabase.storage.from("hr-documents").upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("hr_employee_documents").insert({
        workspace_id: workspaceId,
        employee_id: employeeId,
        document_type: docType,
        document_name: docName.trim() || file.name,
        file_path: path,
        file_size: file.size,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;

      toast.success("Document uploaded");
      setDocName("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  async function handleView(doc: DocumentEntry) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Failed to generate link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(doc: DocumentEntry) {
    if (!confirm(`Delete "${doc.document_name}"?`)) return;
    const supabase = createClient();
    await supabase.storage.from("hr-documents").remove([doc.file_path]);
    const { error } = await supabase.from("hr_employee_documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted");
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Upload ─────────────────────────────────────────────────────── */}
      {isHR && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="h-4 w-4 text-indigo-500" />Upload Document
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Display Name (optional)</Label>
              <Input placeholder="e.g. Aadhaar - front side" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 mt-1">PDF, JPEG, PNG, or WEBP — max 5MB</p>
          </div>
        </div>
      )}

      {/* ── Document list ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-500" />Documents
        </h3>

        {documents.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  {fileIcon(doc.file_path)}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.document_name}</p>
                    <p className="text-xs text-gray-400">
                      {doc.document_type} · {formatBytes(doc.file_size)} · {fmtDate(doc.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleView(doc)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {isHR && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => handleDelete(doc)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
