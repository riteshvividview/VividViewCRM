"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faSpinner, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarCropDialog } from "@/components/shared/avatar-crop-dialog";
import { COUNTRIES } from "@/lib/countries";
import { formatDay } from "@/lib/user-prefs";
import { getInitials } from "@/lib/utils";
import type { UserRole } from "@/types";

const ROLE_LABEL: Record<UserRole, string> = { super_admin: "CEO", hr: "HR", team_lead: "Team lead", employee: "Employee" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const NONE = "__none__";

interface Form { first: string; last: string; country: string; dial: string; phone: string; day: string; month: string }
const EMPTY: Form = { first: "", last: "", country: "", dial: "+91", phone: "", day: "", month: "" };

/** Photo, name, country, phone and birthday. Email and role are shown but managed by the CEO. */
export function ProfileTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [since, setSince] = useState<string | null>(null);
  const [avatar, setAvatar] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("full_name, avatar_url, role, created_at").eq("user_id", user.id).single();
      const meta = user.user_metadata ?? {};
      // The profile row is the source of truth for the name.
      const full = (data?.full_name ?? meta.full_name ?? "").trim();
      const first = typeof meta.first_name === "string" && `${meta.first_name} ${meta.last_name ?? ""}`.trim() === full ? meta.first_name : full.split(" ")[0] ?? "";
      const f: Form = {
        first, last: full.slice(first.length).trim(),
        country: meta.country ?? "", dial: meta.phone_code ?? "+91", phone: meta.phone ?? "",
        day: meta.birthday_day ? String(meta.birthday_day) : "", month: meta.birthday_month ? String(meta.birthday_month) : "",
      };
      setForm(f); setSaved(f);
      setEmail(user.email ?? "");
      setRole((data?.role ?? "employee") as UserRole);
      setSince(data?.created_at ?? user.created_at ?? null);
      setAvatar(data?.avatar_url ?? "");
      setLoading(false);
    })();
  }, []);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const fullName = `${form.first} ${form.last}`.trim();

  async function saveAvatar(url: string | null) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    if (error) { toast.error(error.message); return false; }
    setAvatar(url ?? "");
    router.refresh();
    return true;
  }

  // Any image size is fine: the photo is cropped and redrawn at 512x512 before it is uploaded.
  async function handleCropped(blob: Blob) {
    setUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) { toast.error(`Upload failed: ${error.message}`); return; }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      // The file name never changes, so add a version to make browsers show the new photo.
      if (await saveAvatar(`${publicUrl}?v=${Date.now()}`)) { toast.success("Profile photo updated"); setCropFile(null); }
    } finally { setUploading(false); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first.trim()) { toast.error("First name is required"); return; }
    const day = form.day ? Number(form.day) : null;
    const month = form.month ? Number(form.month) : null;
    if ((day && !month) || (!day && month)) { toast.error("Enter both the day and the month of your birthday"); return; }
    if (day && month && (day < 1 || day > new Date(2024, month, 0).getDate())) { toast.error("That day does not exist in that month"); return; }
    if (form.phone && !/^[0-9 ()-]{5,15}$/.test(form.phone.trim())) { toast.error("Enter a valid phone number"); return; }
    setSaving(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: updated, error } = await supabase.from("profiles").update({ full_name: fullName }).eq("user_id", user.id).select("user_id");
      if (error) { toast.error(error.message); return; }
      if (!updated?.length) { toast.error("Your profile could not be updated. Ask the CEO to check your account."); return; }
      const { error: metaError } = await supabase.auth.updateUser({ data: {
        full_name: fullName, first_name: form.first.trim(), last_name: form.last.trim(),
        country: form.country || null, phone_code: form.dial, phone: form.phone.trim() || null,
        birthday_day: day, birthday_month: month,
      } });
      if (metaError) { toast.error(metaError.message); return; }
      setSaved(form);
      toast.success("Profile saved");
      router.refresh();
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex h-48 items-center justify-center"><FontAwesomeIcon icon={faSpinner} spin className="text-muted-foreground" /></div>;

  return (
    <form onSubmit={save} className="max-w-xl space-y-6">
      <AvatarCropDialog file={cropFile} onCancel={() => setCropFile(null)} onCropped={handleCropped} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
        setCropFile(file);
      }} />

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="group relative shrink-0" aria-label="Change photo">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">{getInitials(fullName || email)}</AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <FontAwesomeIcon icon={uploading ? faSpinner : faCamera} spin={uploading} className="h-4 w-4" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{fullName || "Your name"}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}>{avatar ? "Change photo" : "Upload photo"}</Button>
            {avatar && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={async () => { if (await saveAvatar(null)) toast.success("Profile photo removed"); }}>Remove</Button>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="first">First name</Label>
          <Input id="first" value={form.first} maxLength={60} onChange={(e) => set({ first: e.target.value })} className="h-10" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last">Last name</Label>
          <Input id="last" value={form.last} maxLength={60} onChange={(e) => set({ last: e.target.value })} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={form.country || NONE} onValueChange={(v) => {
            const c = COUNTRIES.find((x) => x.code === v);
            // Picking a country also sets its dialling code while the phone number is still empty.
            set({ country: v === NONE ? "" : v, ...(c && !form.phone ? { dial: c.dial } : {}) });
          }}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NONE}>Not set</SelectItem>
              {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <div className="flex h-10 items-center rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
            <Select value={form.dial} onValueChange={(v) => set({ dial: v })}>
              <SelectTrigger className="ml-1 h-8 w-[84px] shrink-0 border-0 bg-muted/60 px-2 text-sm shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {[...new Map(COUNTRIES.map((c) => [c.dial, c])).values()].map((c) => <SelectItem key={c.dial} value={c.dial}>{c.dial}</SelectItem>)}
              </SelectContent>
            </Select>
            <input id="phone" inputMode="tel" value={form.phone} maxLength={15} placeholder="000 000 0000" onChange={(e) => set({ phone: e.target.value.replace(/[^0-9 ()-]/g, "") })}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bday">Birthday</Label>
          <div className="flex gap-2">
            <Input id="bday" inputMode="numeric" placeholder="Day" value={form.day} maxLength={2} onChange={(e) => set({ day: e.target.value.replace(/\D/g, "") })} className="h-10 w-20" />
            <Select value={form.month || NONE} onValueChange={(v) => set({ month: v === NONE ? "" : v })}>
              <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Month</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={!dirty || saving}>
        {saving && <FontAwesomeIcon icon={faSpinner} spin className="mr-2 h-3.5 w-3.5" />}Save
      </Button>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-5 text-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 font-medium"><FontAwesomeIcon icon={faShieldHalved} className="h-3 w-3 text-muted-foreground" />{ROLE_LABEL[role] ?? role}</span>
        <span className="text-muted-foreground">Your email and role are managed by the CEO.</span>
        {since && <span className="text-muted-foreground">Member since {formatDay(new Date(since), { year: true, month: "long" })}</span>}
      </div>
    </form>
  );
}
