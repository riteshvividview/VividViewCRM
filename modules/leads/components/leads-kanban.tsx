"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScorePill } from "@/components/shared/score-pill";
import { LEAD_STATUSES, STATUS_CONFIG, type Lead, type LeadStatus } from "../types";
import { getInitials, cn } from "@/lib/utils";

const AVATAR_COLORS = ["bg-purple-100 text-purple-700","bg-blue-100 text-blue-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];

const FALLBACK_CFG = { color: "text-muted-foreground", bg: "bg-muted", border: "border-border", dot: "bg-muted-foreground" };

function LeadKanbanCard({ lead, overlay = false }: { lead: Lead; overlay?: boolean }) {
  const cfg = STATUS_CONFIG[lead.status] ?? FALLBACK_CFG;
  const colorClass = AVATAR_COLORS[lead.name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-3.5 shadow-sm select-none",
      "border-l-[3px]", cfg.border,
      overlay && "shadow-2xl rotate-1 scale-105",
    )}>
      <div className="flex items-start gap-2.5">
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarFallback className={cn("text-xs font-semibold", colorClass)}>{getInitials(lead.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
          {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
        </div>
        <ScorePill score={lead.score} />
      </div>
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {lead.source && (
          <span className="text-[11px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{lead.source}</span>
        )}
        {lead.assigned_name && (
          <span className="text-[11px] text-muted-foreground ml-auto">{lead.assigned_name.split(" ")[0]}</span>
        )}
      </div>
    </div>
  );
}

function SortableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <LeadKanbanCard lead={lead} />
    </div>
  );
}

function KanbanColumn({ status, leads, onAddLead }: { status: LeadStatus; leads: Lead[]; onAddLead: () => void }) {
  const cfg = STATUS_CONFIG[status] ?? FALLBACK_CFG;
  const ids = leads.map((l) => l.id);

  return (
    <div className="flex-1 min-w-[240px] max-w-[280px] flex flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />
        <span className="text-sm font-semibold text-foreground">{status}</span>
        <span className={cn("ml-1 text-xs font-semibold rounded-full px-2 py-0.5", cfg.bg, cfg.color)}>{leads.length}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={onAddLead}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Drop zone */}
      <div className={cn("flex-1 rounded-xl p-2 space-y-2 min-h-[120px] transition-colors", `bg-${status === "New" ? "blue" : status === "Contacted" ? "amber" : status === "Qualified" ? "purple" : status === "Proposal" ? "indigo" : status === "Won" ? "emerald" : "red"}-50/30 dark:bg-muted/20`, "border border-dashed border-border/60")}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => <SortableLeadCard key={lead.id} lead={lead} />)}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/60">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

interface LeadsKanbanProps {
  leads: Lead[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onAddLead: () => void;
}

export function LeadsKanban({ leads, onStatusChange, onAddLead }: LeadsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeLead = leads.find((l) => l.id === activeId);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const grouped = LEAD_STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s);
    return acc;
  }, {} as Record<LeadStatus, Lead[]>);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const overId = over.id as string;
    const targetStatus = LEAD_STATUSES.find((s) => s === overId) ?? LEAD_STATUSES.find((s) => grouped[s].some((l) => l.id === overId));
    if (targetStatus && targetStatus !== leads.find((l) => l.id === active.id)?.status) {
      onStatusChange(active.id as string, targetStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            leads={grouped[status]}
            onAddLead={onAddLead}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && <LeadKanbanCard lead={activeLead} overlay />}
      </DragOverlay>
    </DndContext>
  );
}
