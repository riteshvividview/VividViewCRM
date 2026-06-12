"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Save, User, Mail, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UserRole } from "@/types";

const ROLE_CONFIG: Record<UserRole, { label: string; description: string; color: string }> = {
  super_admin: {
    label: "Super Admin",
    description: "Full access to all modules and user management.",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  hr: {
    label: "HR",
    description: "Manages employees, attendance, leaves, and payroll.",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  team_lead: {
    label: "Team Lead",
    description: "Manages team tasks, CRM pipeline, and leave approvals.",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  employee: {
    label: "Employee",
    description: "Access to own tasks, attendance, leaves, and payslips.",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

interface ProfileData {
  full_name: string;
  email: string;
  avatar_url: string;
  role: UserRole;
  workspace_id: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ full_name: "", avatar_url: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) {
        const mock: ProfileData = {
          full_name: "Dev User", email: "dev@vividview.co",
          avatar_url: "", role: "super_admin", workspace_id: null,
          created_at: new Date().toISOString(),
        };
        setProfile(mock);
        setForm({ full_name: mock.full_name, avatar_url: mock.avatar_url });
        setLoading(false);
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const metaName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

      const resolvedName = metaName || data?.full_name?.trim() || user.email?.split("@")[0] || "";
      const p: ProfileData = {
        full_name: resolvedName,
        email: user.email ?? "",
        avatar_url: data?.avatar_url ?? "",
        role: (data?.role ?? "employee") as UserRole,
        workspace_id: data?.workspace_id ?? null,
        created_at: data?.created_at ?? user.created_at,
      };
      setProfile(p);
      setForm({ full_name: p.full_name, avatar_url: p.avatar_url });
      setLoading(false);
    }
    load();
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return; }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { toast.error("Supabase not configured"); return; }
    setUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) { toast.error("Upload failed — make sure the 'avatars' bucket exists in Supabase Storage"); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setForm((f) => ({ ...f, avatar_url: publicUrl }));
      toast.success("Avatar uploaded");
    } finally { setUploading(false); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from("profiles").update({
            full_name: form.full_name.trim(),
            avatar_url: form.avatar_url || null,
            // role is intentionally excluded — managed by super admin only
          }).eq("user_id", user.id);
          if (error) { toast.error(error.message); return; }
        }
      }
      setProfile((p) => p ? { ...p, ...form } : p);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Profile saved");
      router.refresh();
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = form.full_name || profile?.email?.split("@")[0] || "User";
  const role = profile?.role ?? "employee";
  const roleCfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.employee;

  return (
    <div>
      <PageHeader title="Profile" description="Manage your personal information" />

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">

        {/* Avatar */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-purple-600" />Profile Picture
          </h2>
          <div className="flex items-center gap-5 flex-wrap">
            <div className="relative group">
              <Avatar className="h-20 w-20">
                <AvatarImage src={form.avatar_url} />
                <AvatarFallback className="bg-purple-100 text-purple-700 text-2xl font-bold">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploading
                  ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                  : <Camera className="h-5 w-5 text-white" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm text-foreground font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : "Upload photo"}
                </Button>
                {form.avatar_url && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive"
                    onClick={() => setForm((f) => ({ ...f, avatar_url: "" }))}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP · max 2 MB</p>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Or paste an image URL</Label>
            <Input
              placeholder="https://example.com/photo.jpg"
              value={form.avatar_url}
              onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Personal info */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-purple-600" />Personal Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Your full name"
                className="h-10"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />Email
              </Label>
              <Input value={profile?.email ?? ""} disabled className="h-10 bg-muted/50 cursor-not-allowed" />
              <p className="text-[11px] text-muted-foreground">Email is managed through Supabase Auth</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Member since {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
              : "—"}
          </p>
        </div>

        {/* Role — read only */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-600" />Your Role
          </h2>
          <div className="flex items-start gap-4">
            <span className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold shrink-0",
              roleCfg.color
            )}>
              <Shield className="h-3.5 w-3.5" />
              {roleCfg.label}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-foreground">{roleCfg.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Role is assigned by your administrator. Contact your Super Admin to request a change.
              </p>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end pb-4">
          <Button
            type="submit"
            disabled={saving}
            className={cn(
              "gap-2 min-w-[120px]",
              saved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-purple-600 hover:bg-purple-700"
            )}
          >
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : saved
              ? <CheckCircle2 className="h-4 w-4" />
              : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
