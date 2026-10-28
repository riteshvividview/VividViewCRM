"use client";

import { useState, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Check, Upload, Users, FileText, Calendar, Rocket, Sparkles } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faPenToSquare, faBolt, faCalendarDays, faArrowsRotate, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailBuilder } from "./email-builder";
import { useTemplates } from "../hooks/use-templates";
import type { Campaign, AudienceConfig, DripStep, EmailBlock, EmailTemplate } from "../types";
import { PERSONALIZATION_TOKENS } from "../types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Audience",  icon: Users },
  { id: 2, label: "Template",  icon: FileText },
  { id: 3, label: "Content",   icon: Sparkles },
  { id: 4, label: "Schedule",  icon: Calendar },
  { id: 5, label: "Launch",    icon: Rocket },
];

type ScheduleType = "now" | "scheduled" | "drip";

interface WizardState {
  name: string;
  audience: AudienceConfig;
  blocks: EmailBlock[];
  templateId: string | null;
  subject: string;
  previewText: string;
  scheduleType: ScheduleType;
  scheduleTime: string;
  dripSequence: DripStep[];
}

// ── Step 1: Audience ──────────────────────────────────────────────────────────
function StepAudience({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  const sources = [
    { id: "contacts", label: "Contacts", count: 87, desc: "All active contacts in your CRM" },
    { id: "leads",    label: "Leads",    count: 134, desc: "All leads not yet converted" },
    { id: "csv",      label: "CSV Upload", count: 0, desc: "Upload a CSV / Excel file" },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Campaign Name</label>
        <Input className="mt-1 h-9 text-sm" placeholder="e.g. May Newsletter" value={state.name} onChange={(e) => setState({ name: e.target.value })} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Audience Source</label>
        <div className="grid grid-cols-1 gap-2 mt-2">
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setState({ audience: { source: s.id, count: s.count } })}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                state.audience.source === s.id
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                  : "border-border hover:border-purple-200 dark:hover:border-purple-800"
              )}
            >
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", state.audience.source === s.id ? "bg-purple-600" : "bg-muted")}>
                <Users className={cn("h-4 w-4", state.audience.source === s.id ? "text-white" : "text-muted-foreground")} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              {s.count > 0 && (
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">
                  {s.count}
                </span>
              )}
              {state.audience.source === s.id && <Check className="h-4 w-4 text-purple-600 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
      {state.audience.source === "csv" && (
        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-purple-400 transition-colors cursor-pointer">
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Drop CSV or Excel file here</p>
          <p className="text-xs text-muted-foreground mt-1">Columns: email, first_name, company (optional)</p>
        </div>
      )}
      {state.audience.count > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2">
          <Check className="h-4 w-4" />{state.audience.count} recipients will receive this campaign
        </div>
      )}
    </div>
  );
}

// ── Step 2: Template ──────────────────────────────────────────────────────────
function StepTemplate({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  const { templates } = useTemplates();
  const [mode, setMode] = useState<"library" | "builder">("library");

  function selectTemplate(t: EmailTemplate) {
    setState({ templateId: t.id, blocks: t.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })) });
    setMode("builder");
  }

  if (mode === "builder") {
    return (
      <div className="h-[500px] flex flex-col gap-3">
        <div className="flex items-center justify-between shrink-0">
          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => setMode("library")}>
            <ChevronLeft className="h-3.5 w-3.5" />Template library
          </button>
          <span className="text-xs text-muted-foreground">{state.blocks.length} block{state.blocks.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <EmailBuilder blocks={state.blocks} onChange={(blocks) => setState({ blocks })} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Choose a starting template or build from scratch</p>
      <div className="grid grid-cols-1 gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTemplate(t)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
              state.templateId === t.id ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30" : "border-border hover:border-purple-200"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 text-white text-lg">
              <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.blocks.length} blocks</p>
            </div>
            {state.templateId === t.id && <Check className="h-4 w-4 text-purple-600 shrink-0" />}
          </button>
        ))}
        <button
          onClick={() => setState({ templateId: null, blocks: [] })}
          className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-border hover:border-purple-200 text-left transition-all"
          onDoubleClick={() => setMode("builder")}
        >
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xl"><FontAwesomeIcon icon={faPenToSquare} className="h-4 w-4" /></div>
          <div>
            <p className="text-sm font-semibold text-foreground">Blank canvas</p>
            <p className="text-xs text-muted-foreground">Start from scratch</p>
          </div>
        </button>
      </div>
      {(state.templateId || state.blocks.length > 0) && (
        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setMode("builder")}>
          Open Builder <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ── Step 3: Content ───────────────────────────────────────────────────────────
function StepContent({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  function insertToken(token: string) {
    setState({ subject: state.subject + token });
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Subject Line *</label>
        <Input className="mt-1 h-9 text-sm" placeholder="e.g. {{first_name}}, don't miss this…" value={state.subject} onChange={(e) => setState({ subject: e.target.value })} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {PERSONALIZATION_TOKENS.map((t) => (
            <button key={t.token} onClick={() => insertToken(t.token)} className="px-2 py-0.5 text-[10px] font-mono bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 transition-colors">
              {t.token}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Preview Text</label>
        <Input className="mt-1 h-9 text-sm" placeholder="Short summary shown in inbox preview…" value={state.previewText} onChange={(e) => setState({ previewText: e.target.value })} maxLength={150} />
        <p className="text-[11px] text-muted-foreground mt-1">{state.previewText.length}/150 characters</p>
      </div>
      {state.subject && (
        <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Inbox Preview</p>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">VV</div>
            <div>
              <p className="text-xs font-semibold text-foreground">{state.subject.replace("{{first_name}}", "Priya")}</p>
              <p className="text-[11px] text-muted-foreground truncate">{state.previewText || "No preview text set"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Schedule ──────────────────────────────────────────────────────────
function StepSchedule({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  function updateDrip(idx: number, updates: Partial<DripStep>) {
    const seq = [...state.dripSequence];
    seq[idx] = { ...seq[idx], ...updates };
    setState({ dripSequence: seq });
  }
  function addDripStep() {
    const lastDay = state.dripSequence[state.dripSequence.length - 1]?.day ?? 0;
    setState({ dripSequence: [...state.dripSequence, { day: lastDay + 3, subject: "", preview_text: "" }] });
  }

  return (
    <div className="space-y-4">
      {(["now", "scheduled", "drip"] as ScheduleType[]).map((type) => (
        <button
          key={type}
          onClick={() => setState({ scheduleType: type })}
          className={cn(
            "w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all",
            state.scheduleType === type ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30" : "border-border hover:border-purple-200"
          )}
        >
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-lg", state.scheduleType === type ? "bg-purple-600" : "bg-muted")}>
            <FontAwesomeIcon icon={type === "now" ? faBolt : type === "scheduled" ? faCalendarDays : faArrowsRotate} className={cn("h-4 w-4", state.scheduleType === type && "text-white")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {type === "now" ? "Send immediately" : type === "scheduled" ? "Schedule for later" : "Drip sequence"}
            </p>
            <p className="text-xs text-muted-foreground">
              {type === "now" ? "Campaign launches right after you click Launch" : type === "scheduled" ? "Choose a specific date and time" : "Send a series of emails over multiple days"}
            </p>
          </div>
          {state.scheduleType === type && <Check className="h-4 w-4 text-purple-600 mt-0.5 ml-auto shrink-0" />}
        </button>
      ))}

      {state.scheduleType === "scheduled" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">Send At</label>
          <Input type="datetime-local" className="mt-1 h-9 text-sm" value={state.scheduleTime} onChange={(e) => setState({ scheduleTime: e.target.value })} />
        </div>
      )}

      {state.scheduleType === "drip" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Drip Steps</p>
          {state.dripSequence.map((step, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2.5">
              <span className="text-xs font-bold text-purple-600 w-12 shrink-0">Day {step.day}</span>
              <Input className="h-7 text-xs flex-1" placeholder="Subject…" value={step.subject} onChange={(e) => updateDrip(i, { subject: e.target.value })} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addDripStep}>+ Add Step</Button>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Review & Launch ───────────────────────────────────────────────────
function StepReview({ state }: { state: WizardState }) {
  const rows = [
    { label: "Campaign name",  value: state.name || "—" },
    { label: "Audience",       value: state.audience.source ? `${state.audience.count} ${state.audience.source}` : "—" },
    { label: "Subject",        value: state.subject || "—" },
    { label: "Schedule",       value: state.scheduleType === "now" ? "Send immediately" : state.scheduleType === "drip" ? `Drip (${state.dripSequence.length} steps)` : state.scheduleTime || "—" },
    { label: "Template blocks", value: state.blocks.length > 0 ? `${state.blocks.length} blocks` : "No template" },
  ];
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {rows.map((r, i) => (
          <div key={i} className={cn("flex items-start gap-3 px-4 py-3", i > 0 && "border-t border-border/50")}>
            <span className="text-xs text-muted-foreground w-32 shrink-0 pt-0.5">{r.label}</span>
            <span className="text-sm font-medium text-foreground flex-1">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
        <FontAwesomeIcon icon={faTriangleExclamation} className="mr-1.5 h-3 w-3" />Review everything carefully before launching. Sent emails cannot be recalled.
      </div>
    </div>
  );
}

// ── Wizard Shell ─────────────────────────────────────────────────────────────
interface CampaignWizardProps {
  initialData?: Partial<Campaign>;
  onSave: (data: Partial<Campaign>) => void;
  onClose: () => void;
}

export function CampaignWizard({ initialData, onSave, onClose }: CampaignWizardProps) {
  const [step, setStep] = useState(1);
  const [state, setStateRaw] = useState<WizardState>({
    name: initialData?.name ?? "",
    audience: initialData?.audience_config ?? { source: "contacts", count: 87 },
    blocks: initialData?.template_id ? [] : [],
    templateId: initialData?.template_id ?? null,
    subject: initialData?.subject ?? "",
    previewText: initialData?.preview_text ?? "",
    scheduleType: initialData?.schedule_time ? "scheduled" : "now",
    scheduleTime: initialData?.schedule_time ?? "",
    dripSequence: initialData?.drip_sequence ?? [
      { day: 0, subject: "Welcome!", preview_text: "Getting started" },
      { day: 3, subject: "Quick tip", preview_text: "Did you know?" },
      { day: 7, subject: "Check in", preview_text: "How are things going?" },
    ],
  });

  const setState = useCallback((partial: Partial<WizardState>) => {
    setStateRaw((p) => ({ ...p, ...partial }));
  }, []);

  function canProceed() {
    if (step === 1) return !!state.name.trim() && state.audience.count > 0;
    if (step === 3) return !!state.subject.trim();
    return true;
  }

  function handleLaunch() {
    onSave({
      name: state.name,
      audience_config: state.audience,
      template_id: state.templateId,
      subject: state.subject,
      preview_text: state.previewText,
      status: state.scheduleType === "now" ? "sending" : "scheduled",
      schedule_time: state.scheduleType === "scheduled" ? state.scheduleTime : null,
      drip_sequence: state.scheduleType === "drip" ? state.dripSequence : [],
    });
    onClose();
  }

  const stepComponents = [
    <StepAudience  key={1} state={state} setState={setState} />,
    <StepTemplate  key={2} state={state} setState={setState} />,
    <StepContent   key={3} state={state} setState={setState} />,
    <StepSchedule  key={4} state={state} setState={setState} />,
    <StepReview    key={5} state={state} />,
  ];

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Campaign Builder</h2>
            {state.name && <p className="text-xs text-muted-foreground">{state.name}</p>}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-border shrink-0 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => done && setStep(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                    active ? "bg-purple-600 text-white" : done ? "text-purple-600 dark:text-purple-400 hover:bg-muted cursor-pointer" : "text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mx-0.5 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {stepComponents[step - 1]}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="gap-1.5">
            <ChevronLeft className="h-3.5 w-3.5" />{step > 1 ? "Back" : "Cancel"}
          </Button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s) => (
              <span key={s.id} className={cn("w-1.5 h-1.5 rounded-full transition-colors", step === s.id ? "bg-purple-600" : step > s.id ? "bg-purple-300 dark:bg-purple-700" : "bg-muted")} />
            ))}
          </div>
          {step < 5 ? (
            <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleLaunch}>
              <Rocket className="h-3.5 w-3.5" />Launch Campaign
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
