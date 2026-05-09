"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Download, Users, CheckCircle2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarMonth } from "@/modules/calendar/components/calendar-month";
import { CalendarWeek } from "@/modules/calendar/components/calendar-week";
import { CalendarAgenda } from "@/modules/calendar/components/calendar-agenda";
import { MiniCalendar } from "@/modules/calendar/components/mini-calendar";
import { EventDetailPopup } from "@/modules/calendar/components/event-detail-popup";
import { useCalendar } from "@/modules/calendar/hooks/use-calendar";
import type { CalendarEvent, CalendarView, EventType } from "@/modules/calendar/types";
import { EVENT_CONFIG, TEAM_MEMBERS } from "@/modules/calendar/types";
import { cn } from "@/lib/utils";

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "agenda", label: "Agenda" },
];

function exportIcal(events: CalendarEvent[]) {
  const lines: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VividView CRM//Calendar//EN",
  ];
  events.forEach((ev) => {
    const start = new Date(ev.start_time);
    const end = new Date(ev.end_time);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@vividview`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${ev.notes}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "vividview-calendar.ics"; a.click();
  URL.revokeObjectURL(url);
}

export default function CalendarPage() {
  const { events, loading, addEvent, updateEvent, deleteEvent } = useCalendar();
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [newEventTime, setNewEventTime] = useState<{ start: string; end: string } | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [teamView, setTeamView] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(Object.keys(EVENT_CONFIG) as EventType[]));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function navigate(dir: 1 | -1) {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }

  function goToday() { const d = new Date(); setCurrentDate(d); setSelectedDate(d); }

  function headerLabel() {
    if (view === "month") return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (view === "week") {
      const ws = new Date(currentDate); ws.setDate(ws.getDate() - ws.getDay());
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      return `${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${we.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return "Upcoming";
  }

  const filteredEvents = useMemo(() => events.filter((e) => activeTypes.has(e.type)), [events, activeTypes]);

  const eventDates = useMemo(() => new Set(events.map((e) => e.start_time.split("T")[0])), [events]);

  function handleSlotClick(date: Date) {
    const end = new Date(date.getTime() + 3600000);
    setNewEventTime({ start: date.toISOString(), end: end.toISOString() });
    setSelectedEvent(null);
    setIsNew(true);
    setPopupOpen(true);
  }

  function handleEventClick(e: CalendarEvent) {
    setSelectedEvent(e);
    setIsNew(false);
    setPopupOpen(true);
  }

  function toggleType(type: EventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)] min-w-0">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Left sidebar */}
      <div className={cn(
        "flex flex-col gap-4 overflow-y-auto pb-4 transition-transform duration-200",
        "fixed md:static inset-y-0 left-0 z-50 md:z-auto",
        "w-64 md:w-56 shrink-0 bg-background md:bg-transparent p-4 md:p-0 shadow-xl md:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white flex-1" onClick={() => { setSelectedEvent(null); setNewEventTime(null); setIsNew(true); setPopupOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />New Event
          </Button>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <MiniCalendar
          currentDate={currentDate}
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setCurrentDate(d); }}
          onNavigate={setCurrentDate}
          eventDates={eventDates}
        />

        {/* Event type filters */}
        <div className="bg-card border border-border rounded-2xl p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Event Types</p>
          {(Object.keys(EVENT_CONFIG) as EventType[]).map((type) => {
            const cfg = EVENT_CONFIG[type];
            const active = activeTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors", active ? "bg-muted/50 text-foreground" : "text-muted-foreground hover:bg-muted/30")}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", active ? cfg.dot : "bg-muted-foreground/40")} />
                {cfg.label}
                {active && <CheckCircle2 className="h-3 w-3 ml-auto text-purple-500" />}
              </button>
            );
          })}
        </div>

        {/* Team view */}
        <div className="bg-card border border-border rounded-2xl p-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Team</p>
          <button
            onClick={() => setTeamView((v) => !v)}
            className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors", teamView ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300" : "text-muted-foreground hover:bg-muted/30")}
          >
            <Users className="h-3.5 w-3.5" />Team overlay
            {teamView && <CheckCircle2 className="h-3 w-3 ml-auto text-purple-500" />}
          </button>
          {teamView && TEAM_MEMBERS.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-2 py-1 text-xs text-foreground">
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", m.color)} />{m.name}
            </div>
          ))}
        </div>

        {/* Sync integrations */}
        <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Sync</p>
          {["Google Calendar", "Outlook"].map((name) => (
            <div key={name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground flex-1">{name}</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Soon</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Main calendar area */}
      <div className="flex-1 min-w-0 flex flex-col bg-card border border-border rounded-2xl overflow-hidden">
        {/* Calendar header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h2 className="text-sm font-semibold text-foreground">{headerLabel()}</h2>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => exportIcal(events)}>
              <Download className="h-3.5 w-3.5" />Export iCal
            </Button>
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  className={cn("px-3 py-1.5 text-xs font-medium transition-colors", view === v.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}
                  onClick={() => setView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === "month" ? (
          <CalendarMonth currentDate={currentDate} events={filteredEvents} onEventClick={handleEventClick} onSlotClick={handleSlotClick} />
        ) : view === "week" ? (
          <CalendarWeek currentDate={currentDate} events={filteredEvents} onEventClick={handleEventClick} onSlotClick={handleSlotClick} />
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <CalendarAgenda events={filteredEvents} onEventClick={handleEventClick} />
          </div>
        )}
      </div>

      <EventDetailPopup
        event={selectedEvent}
        isNew={isNew}
        initialTime={newEventTime ?? undefined}
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        onSave={(data) => {
          if (isNew) addEvent(data);
          else if (selectedEvent) updateEvent(selectedEvent.id, data);
        }}
        onDelete={(id) => deleteEvent(id)}
      />
    </div>
  );
}
