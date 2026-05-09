"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealCard } from "./deal-card";
import { DEAL_STAGES, STAGE_CONFIG, type Deal, type DealStage } from "../types";
import { formatCurrency, cn } from "@/lib/utils";

function SortableDealCard({ deal, onWon, onLost }: { deal: Deal; onWon: (id: string) => void; onLost: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <DealCard deal={deal} onWon={onWon} onLost={onLost} />
    </div>
  );
}

const STAGE_DOT: Record<DealStage, string> = {
  "Av. Leads":    "bg-slate-400",
  "Samples Sent": "bg-blue-500",
  "Quotes":       "bg-amber-500",
  "Negotiations": "bg-purple-500",
  "Sales":        "bg-emerald-500",
};

function KanbanColumn({ stage, deals, onAddDeal, onWon, onLost }: {
  stage: DealStage; deals: Deal[];
  onAddDeal: () => void;
  onWon: (id: string) => void;
  onLost: (id: string) => void;
}) {
  const cfg = STAGE_CONFIG[stage];
  const total = deals.reduce((s, d) => s + d.value, 0);
  const ids = deals.map((d) => d.id);

  return (
    <div className="flex-shrink-0 w-[260px] flex flex-col">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <span className={cn("w-2 h-2 rounded-full shrink-0", STAGE_DOT[stage])} />
        <span className="text-sm font-semibold text-foreground truncate">{stage}</span>
        <span className={cn("text-xs font-medium rounded-full px-1.5 py-0.5 tabular-nums shrink-0", cfg.bg, cfg.color)}>{deals.length}</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto shrink-0" onClick={onAddDeal}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="px-1 mb-3">
        <span className="text-xs font-bold text-foreground">
          ₹{total >= 100000 ? `${(total / 100000).toFixed(1)}L` : `${(total / 1000).toFixed(0)}K`}
        </span>
        <span className="text-xs text-muted-foreground"> pipeline</span>
      </div>

      <div className="flex-1 rounded-xl p-2 space-y-2 min-h-[200px] bg-muted/20 border border-dashed border-border/50">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} onWon={onWon} onLost={onLost} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50">Drop here</div>
        )}
      </div>
    </div>
  );
}

interface DealsKanbanProps {
  deals: Deal[];
  onStageChange: (id: string, stage: DealStage) => void;
  onAddDeal: () => void;
  onWon: (id: string) => void;
  onLost: (id: string) => void;
}

export function DealsKanban({ deals, onStageChange, onAddDeal, onWon, onLost }: DealsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeDeal = deals.find((d) => d.id === activeId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const grouped = DEAL_STAGES.reduce((acc, s) => {
    acc[s] = deals.filter((d) => d.stage === s);
    return acc;
  }, {} as Record<DealStage, Deal[]>);

  function handleDragStart({ active }: DragStartEvent) { setActiveId(active.id as string); }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const overId = over.id as string;
    const targetStage = DEAL_STAGES.find((s) => s === overId)
      ?? DEAL_STAGES.find((s) => grouped[s].some((d) => d.id === overId));
    const currentStage = deals.find((d) => d.id === active.id)?.stage;
    if (targetStage && targetStage !== currentStage) {
      onStageChange(active.id as string, targetStage);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px] scroll-smooth" style={{ scrollbarWidth: "thin" }}>
        {DEAL_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            deals={grouped[stage]}
            onAddDeal={onAddDeal}
            onWon={onWon}
            onLost={onLost}
          />
        ))}
      </div>
      <DragOverlay>{activeDeal && <DealCard deal={activeDeal} overlay />}</DragOverlay>
    </DndContext>
  );
}
