"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Building2, Globe, Users, MapPin, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { useCompanies } from "@/modules/companies/hooks/use-companies";
import { cn } from "@/lib/utils";
import type { Company } from "@/modules/companies/types";

function formatRevenue(r: number | null) {
  if (!r) return null;
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(1)}Cr`;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(1)}L`;
  return `₹${r.toLocaleString()}`;
}

const INDUSTRY_COLORS: Record<string, string> = {
  Technology:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Finance:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Healthcare:     "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  Manufacturing:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Retail:         "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Consulting:     "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

function CompanyInitials({ name }: { name: string }) {
  const parts = name.split(/\s+/);
  const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return (
    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-white uppercase">{initials}</span>
    </div>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
  const { companies, loading } = useCompanies();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.industry ?? "").toLowerCase().includes(q) ||
      (c.hq_location ?? "").toLowerCase().includes(q)
    );
  }, [companies, search]);

  return (
    <div>
      <PageHeader
        title="Companies"
        description={`${companies.length} compan${companies.length !== 1 ? "ies" : "y"}`}
        action={
          <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="h-3.5 w-3.5" />New Company
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9 text-sm"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onClick={() => router.push(`/dashboard/companies/${company.id}`)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground">No companies found</div>
          )}
        </div>
      )}
    </div>
  );
}

function CompanyCard({ company, onClick }: { company: Company; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        {company.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={company.logo_url} alt={company.name} className="w-11 h-11 rounded-xl object-cover" />
          : <CompanyInitials name={company.name} />
        }
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
            {company.name}
          </h3>
          {company.industry && (
            <span className={cn("inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full", INDUSTRY_COLORS[company.industry] ?? "bg-muted text-muted-foreground")}>
              {company.industry}
            </span>
          )}
        </div>
      </div>

      {company.description && (
        <p className="mt-2.5 text-xs text-muted-foreground line-clamp-2">{company.description}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs text-muted-foreground border-t border-border/50 pt-3">
        {company.hq_location && (
          <div className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />{company.hq_location}
          </div>
        )}
        {company.employee_count && (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 shrink-0" />{company.employee_count} employees
          </div>
        )}
        {company.website && (
          <div className="flex items-center gap-1 truncate col-span-1">
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{company.website.replace(/^https?:\/\//, "")}</span>
          </div>
        )}
        {formatRevenue(company.revenue) && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
              {formatRevenue(company.revenue)}
            </span>
          </div>
        )}
        {company.parent_company_name && (
          <div className="flex items-center gap-1 col-span-2 text-purple-600 dark:text-purple-400">
            <GitBranch className="h-3 w-3 shrink-0" />
            Subsidiary of {company.parent_company_name}
          </div>
        )}
      </div>

      {(company.contact_count ?? 0) > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {company.contact_count} contact{company.contact_count !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
