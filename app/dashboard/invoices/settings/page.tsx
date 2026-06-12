"use client";

import { useEffect, useState } from "react";
import { Save, Building2, CreditCard, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Settings {
  business_name: string; gst_number: string; pan_number: string;
  address: string; city: string; state: string; pincode: string;
  phone: string; email: string;
  bank_name: string; bank_account: string; bank_ifsc: string; bank_branch: string;
  invoice_prefix: string; default_payment_days: number;
  default_notes: string; default_terms: string; tax_type: string;
}

const DEFAULTS: Settings = {
  business_name: "", gst_number: "", pan_number: "",
  address: "", city: "", state: "", pincode: "", phone: "", email: "",
  bank_name: "", bank_account: "", bank_ifsc: "", bank_branch: "",
  invoice_prefix: "INV", default_payment_days: 30,
  default_notes: "Thank you for your business!", default_terms: "Payment due within 30 days.",
  tax_type: "cgst_sgst",
};

export default function InvoiceSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
      if (!profile?.workspace_id) return;
      setWorkspaceId(profile.workspace_id);

      const { data } = await supabase.from("inv_settings").select("*").eq("workspace_id", profile.workspace_id).single();
      if (data) setSettings({ ...DEFAULTS, ...data });
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from("inv_settings").upsert({ workspace_id: workspaceId, ...settings });
      toast.success("Settings saved");
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  }

  function set(field: keyof Settings, value: string | number) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Invoice Settings"
        subtitle="Business profile, tax, and bank details"
        actions={<Button size="sm" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save"}</Button>}
      />

      {/* Business Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">Business Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Business Name *</Label><Input value={settings.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="VividView Solutions" /></div>
          <div><Label>GSTIN</Label><Input value={settings.gst_number} onChange={(e) => set("gst_number", e.target.value)} placeholder="29ABCDE1234F1Z5" /></div>
          <div><Label>PAN</Label><Input value={settings.pan_number} onChange={(e) => set("pan_number", e.target.value)} placeholder="ABCDE1234F" /></div>
          <div className="sm:col-span-2"><Label>Address</Label><Textarea value={settings.address} onChange={(e) => set("address", e.target.value)} rows={2} /></div>
          <div><Label>City</Label><Input value={settings.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div><Label>State</Label><Input value={settings.state} onChange={(e) => set("state", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={settings.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={settings.email} onChange={(e) => set("email", e.target.value)} /></div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-4 w-4 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">Bank Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Bank Name</Label><Input value={settings.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="HDFC Bank" /></div>
          <div><Label>Account Number</Label><Input value={settings.bank_account} onChange={(e) => set("bank_account", e.target.value)} /></div>
          <div><Label>IFSC Code</Label><Input value={settings.bank_ifsc} onChange={(e) => set("bank_ifsc", e.target.value)} /></div>
          <div><Label>Branch</Label><Input value={settings.bank_branch} onChange={(e) => set("bank_branch", e.target.value)} /></div>
        </div>
      </div>

      {/* Invoice Preferences */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">Invoice Preferences</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Invoice Prefix</Label><Input value={settings.invoice_prefix} onChange={(e) => set("invoice_prefix", e.target.value)} placeholder="INV" /></div>
          <div><Label>Payment Terms (days)</Label><Input type="number" value={settings.default_payment_days} onChange={(e) => set("default_payment_days", Number(e.target.value))} /></div>
          <div>
            <Label>Default Tax Type</Label>
            <Select value={settings.tax_type} onValueChange={(v) => set("tax_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cgst_sgst">CGST + SGST (Intra-state)</SelectItem>
                <SelectItem value="igst">IGST (Inter-state)</SelectItem>
                <SelectItem value="no_tax">No Tax</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Default Notes</Label><Textarea value={settings.default_notes} onChange={(e) => set("default_notes", e.target.value)} rows={2} /></div>
        <div><Label>Default Terms</Label><Textarea value={settings.default_terms} onChange={(e) => set("default_terms", e.target.value)} rows={2} /></div>
      </div>
    </div>
  );
}
