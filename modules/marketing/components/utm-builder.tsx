"use client";

import { useState } from "react";
import { Copy, CheckCheck, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { UtmParams } from "../types";

const BASE_URL = "https://vividview.com";

interface UtmBuilderProps {
  initial?: Partial<UtmParams>;
  onSave?: (params: UtmParams) => void;
}

export function UtmBuilder({ initial, onSave }: UtmBuilderProps) {
  const [params, setParams] = useState<UtmParams>({
    source: initial?.source ?? "",
    medium: initial?.medium ?? "",
    campaign: initial?.campaign ?? "",
    term: initial?.term ?? "",
    content: initial?.content ?? "",
  });
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof UtmParams>(k: K, v: string) => setParams((p) => ({ ...p, [k]: v }));

  const query = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `utm_${k}=${encodeURIComponent(v)}`)
    .join("&");

  const fullUrl = `${BASE_URL}${query ? `?${query}` : ""}`;

  function copyUrl() {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const FIELDS: { key: keyof UtmParams; label: string; placeholder: string; required?: boolean }[] = [
    { key: "source",   label: "Source",   placeholder: "google, facebook, newsletter…",  required: true },
    { key: "medium",   label: "Medium",   placeholder: "cpc, email, social…",           required: true },
    { key: "campaign", label: "Campaign", placeholder: "crm-launch, q2-promo…",          required: true },
    { key: "term",     label: "Term",     placeholder: "crm software india" },
    { key: "content",  label: "Content",  placeholder: "banner-a, sidebar-cta" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, placeholder, required }) => (
          <div key={key}>
            <label className="text-xs font-medium text-muted-foreground">
              {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              placeholder={placeholder}
              value={params[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Generated URL */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
          <Link2 className="h-3 w-3" />Generated UTM URL
        </label>
        <div className="flex gap-2">
          <div className="flex-1 text-xs bg-muted text-muted-foreground rounded-lg px-3 py-2 font-mono break-all min-h-[36px] flex items-center">
            {fullUrl}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 shrink-0 gap-1.5"
            onClick={copyUrl}
            disabled={!params.source || !params.medium || !params.campaign}
          >
            {copied ? <><CheckCheck className="h-3.5 w-3.5 text-emerald-600" />Copied!</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
          </Button>
        </div>
      </div>

      {onSave && (
        <Button
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => onSave(params)}
          disabled={!params.source || !params.medium || !params.campaign}
        >
          Save UTM Parameters
        </Button>
      )}
    </div>
  );
}
