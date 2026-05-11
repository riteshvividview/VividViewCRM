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

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "brand_manager",        label: "Brand Manager",        description: "Oversees brand identity and positioning" },
  { value: "campaign_manager",     label: "Campaign Manager",     description: "Plans and executes marketing campaigns" },
  { value: "content_creator",      label: "Content Creator",      description: "Produces written and multimedia content" },
  { value: "copywriter",           label: "Copywriter",           description: "Crafts compelling copy for ads and web" },
  { value: "digital_strategist",   label: "Digital Strategist",   description: "Shapes the overall digital marketing strategy" },
  { value: "graphic_designer",     label: "Graphic Designer",     description: "Designs visuals across all channels" },
  { value: "seo_specialist",       label: "SEO Specialist",       description: "Optimises search rankings and organic traffic" },
  { value: "social_media_manager", label: "Social Media Manager", description: "Manages social channels and community" },
  { value: "video_editor",         label: "Video Editor",         description: "Edits and produces video content" },
  { value: "account_manager",      label: "Account Manager",      description: "Manages client relationships and deliverables" },
  { value: "admin",                label: "Admin",                description: "Full access to all features and settings" },
];

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
  const [form, setForm] = useState({ full_name: "", avatar_url: "", role: "content_creator" as UserRole });
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
          avatar_url: "", role: "admin", workspace_id: null,
          created_at: new Date().toISOString(),
        };
        setProfile(mock);
        setForm({ full_name: mock.full_name, avatar_url: mock.avatar_url, role: mock.role });
        setLoading(false);
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Auth metadata is the most reliable source for the full name
      const metaName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

      const resolvedName = metaName || data?.full_name?.trim() || user.email?.split("@")[0] || "";
      const p: ProfileData = {
        full_name: resolvedName,
        email: user.email ?? "",
        avatar_url: data?.avatar_url ?? "",
        role: (data?.role ?? "content_creator") as UserRole,
        workspace_id: data?.workspace_id ?? null,
        created_at: data?.created_at ?? user.created_at,
      };
      setProfile(p);
      setForm({ full_name: p.full_name, avatar_url: p.avatar_url, role: p.role });
      setLoading(false);
    }
    load();
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return; }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) { toast.error("Supabase not configured"); return; }
    setUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) { toast.error("Upload failed — make sure the 'avatars' storage bucket exists in Supabase"); return; }
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
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (url) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from("profiles").update({
            full_name: form.full_name.trim(),
            avatar_url: form.avatar_url || null,
            role: form.role,
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

  return (
    <div>
      <PageHeader title="Profile" description="Manage your personal information and role" />

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
                {uploading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
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
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setForm((f) => ({ ...f, avatar_url: "" }))}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP · max 2 MB. Requires "avatars" bucket in Supabase Storage.</p>
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
            Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "—"}
          </p>
        </div>

        {/* Role */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-600" />Your Role
          </h2>
          <p className="text-xs text-muted-foreground -mt-2">Select the role that best describes your position in the agency.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                className={cn(
                  "text-left p-4 rounded-xl border-2 transition-all",
                  form.role === r.value
                    ? "border-purple-600 bg-purple-50 dark:bg-purple-950/30"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className={cn("text-sm font-semibold", form.role === r.value ? "text-purple-700 dark:text-purple-300" : "text-foreground")}>
                    {r.label}
                  </p>
                  {form.role === r.value && <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{r.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end pb-4">
          <Button
            type="submit"
            disabled={saving}
            className={cn("gap-2 min-w-[120px]", saved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-purple-600 hover:bg-purple-700")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
