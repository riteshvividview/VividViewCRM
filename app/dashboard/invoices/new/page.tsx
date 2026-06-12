"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

interface LineItem { description: string; hsn_sac: string; quantity: number; unit: string; unit_price: number; tax_rate: number; }

const TAX_RATES = [0, 5, 12, 18, 28];
const UNITS = ["Nos", "Hrs", "Days", "Kg", "L", "Pcs", "Set", "Sqft"];

function calcItem(item: LineItem) {
  const amount = item.quantity * item.unit_price;
  const tax = amount * (item.tax_rate / 100);
  return { amount, tax, total: amount + tax };
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [client, setClient] = useState({ name: "", email: "", phone: "", address: "", city: "", state: "", pincode: "", gstin: "" });
  const [dates, setDates] = useState({ issue: new Date().toISOString().split("T")[0], due: "" });
  const [items, setItems] = useState<LineItem[]>([{ description: "", hsn_sac: "", quantity: 1, unit: "Nos", unit_price: 0, tax_rate: 18 }]);
  const [discount, setDiscount] = useState({ type: "none", value: 0 });
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  function addItem() {
    setItems((prev) => [...prev, { description: "", hsn_sac: "", quantity: 1, unit: "Nos", unit_price: 0, tax_rate: 18 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  const subtotal = items.reduce((s, i) => s + calcItem(i).amount, 0);
  const totalTax = items.reduce((s, i) => s + calcItem(i).tax, 0);
  const discountAmount = discount.type === "percent" ? subtotal * (discount.value / 100) : discount.type === "flat" ? discount.value : 0;
  const grandTotal = subtotal - discountAmount + totalTax;

  async function save(status: "draft" | "sent") {
    if (!client.name) { toast.error("Client name is required"); return; }
    if (items.some((i) => !i.description)) { toast.error("All items need a description"); return; }
    if (items.some((i) => i.unit_price <= 0)) { toast.error("All items need a price > 0"); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
      if (!profile?.workspace_id) throw new Error("No workspace");

      // Get current invoice number from settings
      const { data: settings } = await supabase.from("inv_settings").select("invoice_prefix, next_invoice_number").eq("workspace_id", profile.workspace_id).single();
      const prefix = settings?.invoice_prefix ?? "INV";
      const num = String(settings?.next_invoice_number ?? 1).padStart(4, "0");
      const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${num}`;

      const { data: inv, error } = await supabase.from("invoices").insert({
        workspace_id: profile.workspace_id,
        invoice_number: invoiceNumber,
        client_name: client.name, client_email: client.email, client_phone: client.phone,
        client_address: client.address, client_city: client.city, client_state: client.state,
        client_pincode: client.pincode, client_gstin: client.gstin,
        issue_date: dates.issue, due_date: dates.due || null,
        status,
        subtotal, discount_type: discount.type, discount_value: discount.value, discount_amount: discountAmount,
        cgst_amount: totalTax / 2, sgst_amount: totalTax / 2, igst_amount: 0,
        tax_amount: totalTax, total_amount: grandTotal, amount_paid: 0, amount_due: grandTotal,
        notes, terms, created_by: user.id,
      }).select("id").single();

      if (error) throw error;

      await supabase.from("invoice_items").insert(
        items.map((item, idx) => ({
          invoice_id: inv!.id, workspace_id: profile.workspace_id,
          description: item.description, hsn_sac: item.hsn_sac,
          quantity: item.quantity, unit: item.unit, unit_price: item.unit_price,
          tax_rate: item.tax_rate, amount: calcItem(item).amount, tax_amount: calcItem(item).tax,
          total: calcItem(item).total, position: idx,
        }))
      );

      // Increment invoice number
      await supabase.from("inv_settings").update({ next_invoice_number: (settings?.next_invoice_number ?? 1) + 1 }).eq("workspace_id", profile.workspace_id);

      toast.success(`Invoice ${invoiceNumber} ${status === "sent" ? "sent" : "saved as draft"}`);
      router.push(`/dashboard/invoices/${inv!.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="New Invoice"
        subtitle="Create and send invoice to your client"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link href="/dashboard/invoices"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
            <Button variant="outline" size="sm" onClick={() => save("draft")} disabled={saving}><Save className="h-4 w-4 mr-1" />Save Draft</Button>
            <Button size="sm" onClick={() => save("sent")} disabled={saving}>Create Invoice</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main form */}
        <div className="lg:col-span-3 space-y-6">

          {/* Client info */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Bill To</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Client / Company Name *</Label>
                <Input placeholder="Acme Corporation" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" placeholder="billing@acme.com" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input placeholder="+91 98765 43210" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Input placeholder="123, Street, Area" value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} />
              </div>
              <div>
                <Label>City</Label>
                <Input placeholder="Bangalore" value={client.city} onChange={(e) => setClient({ ...client, city: e.target.value })} />
              </div>
              <div>
                <Label>State</Label>
                <Input placeholder="Karnataka" value={client.state} onChange={(e) => setClient({ ...client, state: e.target.value })} />
              </div>
              <div>
                <Label>GSTIN</Label>
                <Input placeholder="29ABCDE1234F1Z5" value={client.gstin} onChange={(e) => setClient({ ...client, gstin: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Issue Date *</Label>
                <Input type="date" value={dates.issue} onChange={(e) => setDates({ ...dates, issue: e.target.value })} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={dates.due} onChange={(e) => setDates({ ...dates, due: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Line Items</h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Description *"
                      value={item.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="HSN/SAC"
                      value={item.hsn_sac}
                      onChange={(e) => updateItem(idx, "hsn_sac", e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                      className="w-20"
                      min={0.001}
                    />
                    <Select value={item.unit} onValueChange={(v) => updateItem(idx, "unit", v)}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Unit Price ₹"
                      value={item.unit_price || ""}
                      onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))}
                      className="flex-1 min-w-[100px]"
                      min={0}
                    />
                    <Select value={String(item.tax_rate)} onValueChange={(v) => updateItem(idx, "tax_rate", Number(v))}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>{TAX_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex items-center min-w-[80px] text-sm font-medium text-gray-700">
                      {formatINR(calcItem(item).total)}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
          </div>

          {/* Notes & Terms */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Thank you for your business!" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Textarea placeholder="Payment due within 30 days..." value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        {/* Summary panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4 sticky top-4">
            <h3 className="font-semibold text-gray-900">Summary</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>

              {/* Discount */}
              <div className="flex gap-2 items-center">
                <Select value={discount.type} onValueChange={(v) => setDiscount({ ...discount, type: v })}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Discount</SelectItem>
                    <SelectItem value="percent">% Discount</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
                {discount.type !== "none" && (
                  <Input
                    type="number" className="h-7 text-xs w-20" min={0}
                    value={discount.value || ""}
                    onChange={(e) => setDiscount({ ...discount, value: Number(e.target.value) })}
                  />
                )}
                {discountAmount > 0 && <span className="text-red-600 text-xs ml-auto">-{formatINR(discountAmount)}</span>}
              </div>

              <div className="flex justify-between text-gray-600">
                <span>CGST (9%)</span>
                <span>{formatINR(totalTax / 2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>SGST (9%)</span>
                <span>{formatINR(totalTax / 2)}</span>
              </div>

              <Separator />

              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>Total</span>
                <span>{formatINR(grandTotal)}</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Button className="w-full" onClick={() => save("sent")} disabled={saving}>
                {saving ? "Saving…" : "Create Invoice"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => save("draft")} disabled={saving}>
                Save as Draft
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
