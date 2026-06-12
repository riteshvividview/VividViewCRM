"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Printer, IndianRupee, CheckCircle2, Send,
  XCircle, Clock, Plus,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  client_city: string;
  client_state: string;
  client_gstin: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  notes: string;
  terms: string;
  invoice_items: { id: string; description: string; hsn_sac: string; quantity: number; unit: string; unit_price: number; tax_rate: number; amount: number; tax_amount: number; total: number }[];
  invoice_payments: { id: string; amount: number; payment_date: string; payment_method: string; reference_number: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [settings, setSettings] = useState<{ business_name: string; address: string; gst_number: string; bank_name: string; bank_account: string; bank_ifsc: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState({ amount: "", date: new Date().toISOString().split("T")[0], method: "bank_transfer", ref: "" });

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
    if (!profile?.workspace_id) return;

    const [{ data: inv }, { data: s }] = await Promise.all([
      supabase.from("invoices").select("*, invoice_items(*, position), invoice_payments(*)").eq("id", id).eq("workspace_id", profile.workspace_id).single(),
      supabase.from("inv_settings").select("business_name, address, gst_number, bank_name, bank_account, bank_ifsc").eq("workspace_id", profile.workspace_id).single(),
    ]);

    if (inv) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sorted = { ...inv, invoice_items: [...(inv.invoice_items ?? [])].sort((a: any, b: any) => a.position - b.position) };
      setInvoice(sorted as InvoiceDetail);
    }
    if (s) setSettings(s);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function recordPayment() {
    if (!payment.amount || Number(payment.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !invoice) return;
    const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
    if (!profile?.workspace_id) return;

    const newPaid = Number(invoice.amount_paid) + Number(payment.amount);
    const newDue = Math.max(0, Number(invoice.total_amount) - newPaid);
    const newStatus = newDue <= 0 ? "paid" : "partial";

    await Promise.all([
      supabase.from("invoice_payments").insert({
        invoice_id: id, workspace_id: profile.workspace_id,
        amount: Number(payment.amount), payment_date: payment.date,
        payment_method: payment.method, reference_number: payment.ref, created_by: user.id,
      }),
      supabase.from("invoices").update({ amount_paid: newPaid, amount_due: newDue, status: newStatus }).eq("id", id),
    ]);

    toast.success("Payment recorded");
    setShowPayment(false);
    setPayment({ amount: "", date: new Date().toISOString().split("T")[0], method: "bank_transfer", ref: "" });
    load();
  }

  if (loading) return <div className="h-96 bg-gray-50 rounded-xl animate-pulse" />;
  if (!invoice) return <div className="text-center py-20 text-gray-400">Invoice not found</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild><Link href="/dashboard/invoices"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-xl font-bold text-gray-900 font-mono">{invoice.invoice_number}</h1>
          <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLES[invoice.status] ?? "bg-gray-100 text-gray-600")}>
            {invoice.status}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
          {invoice.status === "draft" && (
            <Button size="sm"><Send className="h-4 w-4 mr-1" />Mark as Sent</Button>
          )}
          {!["paid", "cancelled"].includes(invoice.status) && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setShowPayment(true)}>
              <IndianRupee className="h-4 w-4 mr-1" />Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Invoice document */}
      <div className="bg-white rounded-xl border border-gray-100 p-8 print:shadow-none" id="invoice-print">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{settings?.business_name || "Your Business"}</h2>
            <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">{settings?.address}</p>
            {settings?.gst_number && <p className="text-sm text-gray-500">GSTIN: {settings.gst_number}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-indigo-600 tracking-tight">INVOICE</p>
            <p className="text-sm font-mono font-bold text-gray-900 mt-1">{invoice.invoice_number}</p>
          </div>
        </div>

        {/* Dates & client */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">{invoice.client_name}</p>
            {invoice.client_email && <p className="text-sm text-gray-500">{invoice.client_email}</p>}
            {invoice.client_phone && <p className="text-sm text-gray-500">{invoice.client_phone}</p>}
            {invoice.client_address && <p className="text-sm text-gray-500 mt-1">{invoice.client_address}{invoice.client_city ? `, ${invoice.client_city}` : ""}{invoice.client_state ? `, ${invoice.client_state}` : ""}</p>}
            {invoice.client_gstin && <p className="text-sm text-gray-500">GSTIN: {invoice.client_gstin}</p>}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <p className="text-sm"><span className="text-gray-400">Issue Date:</span> <span className="font-medium">{new Date(invoice.issue_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</span></p>
              {invoice.due_date && <p className="text-sm"><span className="text-gray-400">Due Date:</span> <span className={cn("font-medium", new Date(invoice.due_date) < new Date() && invoice.status !== "paid" ? "text-red-600" : "")}>{new Date(invoice.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</span></p>}
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left px-3 py-2.5 rounded-tl-lg">#</th>
              <th className="text-left px-3 py-2.5">Description</th>
              <th className="text-center px-3 py-2.5">Qty</th>
              <th className="text-right px-3 py-2.5">Rate</th>
              <th className="text-center px-3 py-2.5">Tax</th>
              <th className="text-right px-3 py-2.5 rounded-tr-lg">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_items.map((item, idx) => (
              <tr key={item.id} className={cn("border-b border-gray-100", idx % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-gray-900">{item.description}</span>
                  {item.hsn_sac && <span className="text-xs text-gray-400 ml-2">HSN: {item.hsn_sac}</span>}
                </td>
                <td className="px-3 py-2.5 text-center">{item.quantity} {item.unit}</td>
                <td className="px-3 py-2.5 text-right">{formatINR(Number(item.unit_price))}</td>
                <td className="px-3 py-2.5 text-center text-gray-500">{item.tax_rate}%</td>
                <td className="px-3 py-2.5 text-right font-medium">{formatINR(Number(item.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatINR(Number(invoice.subtotal))}</span></div>
            {Number(invoice.discount_amount) > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatINR(Number(invoice.discount_amount))}</span></div>}
            {Number(invoice.cgst_amount) > 0 && <div className="flex justify-between text-gray-500"><span>CGST</span><span>{formatINR(Number(invoice.cgst_amount))}</span></div>}
            {Number(invoice.sgst_amount) > 0 && <div className="flex justify-between text-gray-500"><span>SGST</span><span>{formatINR(Number(invoice.sgst_amount))}</span></div>}
            {Number(invoice.igst_amount) > 0 && <div className="flex justify-between text-gray-500"><span>IGST</span><span>{formatINR(Number(invoice.igst_amount))}</span></div>}
            <Separator />
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatINR(Number(invoice.total_amount))}</span></div>
            {Number(invoice.amount_paid) > 0 && <div className="flex justify-between text-green-600"><span>Paid</span><span>-{formatINR(Number(invoice.amount_paid))}</span></div>}
            {Number(invoice.amount_due) > 0 && (
              <div className="flex justify-between font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                <span>Amount Due</span><span>{formatINR(Number(invoice.amount_due))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bank details */}
        {settings?.bank_account && (
          <div className="mt-8 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Bank Details</p>
            <div className="text-sm text-gray-600 space-y-0.5">
              <p>{settings.bank_name}</p>
              <p>A/C: {settings.bank_account}</p>
              <p>IFSC: {settings.bank_ifsc}</p>
            </div>
          </div>
        )}

        {(invoice.notes || invoice.terms) && (
          <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
            {invoice.notes && <div><p className="font-medium text-gray-700 mb-1">Notes</p><p className="text-gray-500">{invoice.notes}</p></div>}
            {invoice.terms && <div><p className="font-medium text-gray-700 mb-1">Terms</p><p className="text-gray-500">{invoice.terms}</p></div>}
          </div>
        )}
      </div>

      {/* Payments */}
      {invoice.invoice_payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Payment History</h3>
          <div className="space-y-2">
            {invoice.invoice_payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatINR(Number(p.amount))}</p>
                    <p className="text-xs text-gray-500">{p.payment_method.replace("_", " ")} · {p.reference_number}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{new Date(p.payment_date).toLocaleDateString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record payment panel */}
      {showPayment && (
        <div className="bg-white rounded-xl border border-indigo-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Record Payment</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" placeholder={String(invoice.amount_due)} value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={payment.method} onValueChange={(v) => setPayment({ ...payment, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference #</Label>
              <Input placeholder="UTR123..." value={payment.ref} onChange={(e) => setPayment({ ...payment, ref: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={recordPayment} className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-4 w-4 mr-1" />Save Payment</Button>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
