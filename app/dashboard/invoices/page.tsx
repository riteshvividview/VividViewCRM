"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Search, IndianRupee, TrendingUp, Clock,
  AlertTriangle, MoreHorizontal, Eye, Send,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  issue_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  sent:      "bg-blue-100 text-blue-700",
  viewed:    "bg-indigo-100 text-indigo-700",
  partial:   "bg-yellow-100 text-yellow-700",
  paid:      "bg-green-100 text-green-700",
  overdue:   "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, paid: 0, outstanding: 0, overdue: 0 });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("user_id", user.id).single();
      if (!profile?.workspace_id) return;

      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, client_name, issue_date, due_date, total_amount, amount_paid, amount_due, status")
        .eq("workspace_id", profile.workspace_id)
        .order("created_at", { ascending: false });

      const invs = (data ?? []) as Invoice[];
      setInvoices(invs);

      const active = invs.filter((i) => i.status !== "cancelled");
      const now = new Date();
      setStats({
        total: active.reduce((s, i) => s + Number(i.total_amount), 0),
        paid: active.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0),
        outstanding: active.reduce((s, i) => s + Number(i.amount_due), 0),
        overdue: active.filter((i) => i.due_date && new Date(i.due_date) < now && !["paid", "cancelled"].includes(i.status)).length,
      });
      setLoading(false);
    }
    load();
  }, []);

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!inv.invoice_number.toLowerCase().includes(q) && !inv.client_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total`}
        actions={<Button asChild size="sm"><Link href="/dashboard/invoices/new"><Plus className="h-4 w-4 mr-2" />New Invoice</Link></Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Invoiced", value: formatINR(stats.total), icon: <IndianRupee className="h-4 w-4" />, color: "bg-blue-50 text-blue-600" },
          { label: "Collected", value: formatINR(stats.paid), icon: <TrendingUp className="h-4 w-4" />, color: "bg-green-50 text-green-600" },
          { label: "Outstanding", value: formatINR(stats.outstanding), icon: <Clock className="h-4 w-4" />, color: "bg-yellow-50 text-yellow-600" },
          { label: "Overdue", value: stats.overdue, icon: <AlertTriangle className="h-4 w-4" />, color: "bg-red-50 text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{s.label}</p>
              <div className={cn("p-1.5 rounded-lg", s.color)}>{s.icon}</div>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-2">{loading ? "—" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search by invoice # or client..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Issue Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Due</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No invoices found</td></tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono font-medium text-indigo-600 hover:text-indigo-800">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-700">{inv.client_name}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                      {new Date(inv.issue_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs">
                      {inv.due_date ? (
                        <span className={cn(new Date(inv.due_date) < new Date() && !["paid","cancelled"].includes(inv.status) ? "text-red-600 font-medium" : "text-gray-500")}>
                          {new Date(inv.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatINR(Number(inv.total_amount))}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-600">{Number(inv.amount_due) > 0 ? formatINR(Number(inv.amount_due)) : <span className="text-green-600">Paid</span>}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_STYLES[inv.status] ?? "bg-gray-100 text-gray-600")}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link href={`/dashboard/invoices/${inv.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
