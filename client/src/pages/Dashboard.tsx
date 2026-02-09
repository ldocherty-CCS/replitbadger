import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, endOfWeek, parseISO, parse } from "date-fns";
import { Input } from "@/components/ui/input";
import { MobileCalendarView } from "@/components/MobileCalendarView";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useJobs, useUpdateJob, useDeleteJob, useDuplicateJob, useDeleteJobSeries, useMoveJobSeries } from "@/hooks/use-jobs";
import { queryClient } from "@/lib/queryClient";
import { useOperators } from "@/hooks/use-operators";
import { JobCard, wasContextAction } from "@/components/JobCard";
import { CreateJobDialog } from "@/components/CreateJobDialog";
import { PlaceHoldDialog } from "@/components/PlaceHoldDialog";
import { TimeOffDialog } from "@/components/TimeOffDialog";
import { JobDetailsDialog } from "@/components/JobDetailsDialog";
import { DispatchNoteDialog } from "@/components/DispatchNoteDialog";
import { useTimeOff, useRemoveTimeOffDay, useDeleteTimeOff, useCreateTimeOff } from "@/hooks/use-time-off";
import { useAllOperatorAvailability } from "@/hooks/use-operator-availability";
import { ChevronLeft, ChevronRight, Plus, Loader2, PanelRightClose, PanelRightOpen, Ban, ChevronDown, ChevronUp, Clock3, RotateCcw, CalendarOff, StickyNote, FileText, Eye, Search, X, Calendar, Trash2, Keyboard, Undo2, Sun, CloudSun, CloudFog, CloudRain, Snowflake, CloudLightning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatOperatorShortName, formatOperatorFullName } from "@/lib/utils";
import { getOperatorColor } from "@/lib/operator-colors";
import type { Job, Customer, Operator } from "@shared/schema";
import { DroppableDay } from "@/components/DroppableDay";
import { useToast } from "@/hooks/use-toast";
import { DashboardMapPanel } from "@/components/DashboardMapPanel";
import { api } from "@shared/routes";

const STATUS_COLORS: Record<string, { hex: string; label: string }> = {
  dispatched: { hex: "#22c55e", label: "Dispatched" },
  unavailable: { hex: "#ef4444", label: "Unavailable" },
  ready: { hex: "#1e40af", label: "Ready" },
  ticket_created: { hex: "#38bdf8", label: "Ticket Created" },
  existing: { hex: "#9ca3af", label: "Existing" },
  missing_info: { hex: "#f472b6", label: "Missing Info" },
  not_qualified: { hex: "#fb923c", label: "Not Qualified" },
  cancelled: { hex: "#8b8b8b", label: "Cancelled" },
  standby: { hex: "#8b5cf6", label: "Standby" },
};

function DayCell({ 
  date, 
  operatorId, 
  jobs, 
  locationGroupMap,
  assistantJobIds,
  onJobClick,
  onDuplicate,
  onDelete,
  onStatusChange,
  onCancel,
  onRestore,
  onCellClick,
  onPlaceHold,
  onAddNote,
  onRemoveOff,
  onOffDayClick,
  onAddDayOff,
  onMoveUp,
  onMoveDown,
  isEvenRow,
  isOff,
  isFocused,
}: { 
  date: string, 
  operatorId: number, 
  jobs: Job[], 
  locationGroupMap: Record<number, { index: number; total: number }>,
  assistantJobIds: Set<number>,
  onJobClick: (job: Job) => void,
  onDuplicate: (job: Job) => void,
  onDelete: (job: Job) => void,
  onStatusChange: (job: Job, status: string) => void,
  onCancel: (job: Job) => void,
  onRestore: (job: Job) => void,
  onCellClick: (date: string, operatorId: number) => void,
  onPlaceHold: (date: string, operatorId: number) => void,
  onAddNote: (date: string, operatorId: number, noteType: string) => void,
  onRemoveOff: (operatorId: number, date: string) => void,
  onOffDayClick: (operatorId: number, date: string) => void,
  onAddDayOff: (operatorId: number, date: string) => void,
  onMoveUp: (job: Job) => void,
  onMoveDown: (job: Job) => void,
  isEvenRow?: boolean,
  isOff?: boolean,
  isFocused?: boolean,
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [noteCtxMenu, setNoteCtxMenu] = useState<{ x: number; y: number; noteId: number } | null>(null);
  const noteCtxMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = (e: MouseEvent) => {
      if (ctxMenuRef.current && ctxMenuRef.current.contains(e.target as Node)) return;
      setCtxMenu(null);
    };
    const dismissScroll = () => setCtxMenu(null);
    setTimeout(() => {
      window.addEventListener("mousedown", dismiss);
      window.addEventListener("contextmenu", dismiss);
      window.addEventListener("scroll", dismissScroll, true);
    }, 0);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("contextmenu", dismiss);
      window.removeEventListener("scroll", dismissScroll, true);
    };
  }, [ctxMenu]);

  useEffect(() => {
    if (!noteCtxMenu) return;
    const dismiss = (e: MouseEvent) => {
      if (noteCtxMenuRef.current && noteCtxMenuRef.current.contains(e.target as Node)) return;
      setNoteCtxMenu(null);
    };
    const dismissScroll = () => setNoteCtxMenu(null);
    setTimeout(() => {
      window.addEventListener("mousedown", dismiss);
      window.addEventListener("contextmenu", dismiss);
      window.addEventListener("scroll", dismissScroll, true);
    }, 0);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("contextmenu", dismiss);
      window.removeEventListener("scroll", dismissScroll, true);
    };
  }, [noteCtxMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-testid^="card-job-"]')) return;
    e.preventDefault();
    e.stopPropagation();
    setNoteCtxMenu(null);
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <DroppableDay 
      id={`cell-${operatorId}-${date}`} 
      date={date} 
      operatorId={operatorId}
      className={cn(
        "min-h-[80px] p-1.5 border-r border-b hover:bg-accent/40 transition-colors cursor-pointer relative",
        isOff
          ? "bg-red-200/70 dark:bg-red-900/40"
          : isEvenRow ? "bg-muted/30" : "bg-card/50",
        isFocused && "ring-2 ring-primary ring-inset"
      )}
    >
      {isOff && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer z-[3]"
          style={{
            backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(239,68,68,0.15) 8px, rgba(239,68,68,0.15) 10px)",
          }}
          onClick={(e) => { e.stopPropagation(); onOffDayClick(operatorId, date); }}
          onContextMenu={handleContextMenu}
          data-testid={`off-overlay-${operatorId}-${date}`}
        >
          {jobs.length === 0 && (
            <span className="text-sm font-bold text-red-500 dark:text-red-400 uppercase tracking-wider drop-shadow-sm">OFF</span>
          )}
        </div>
      )}
      <div 
        className="h-full min-h-[60px] relative z-[2]" 
        onClick={() => onCellClick(date, operatorId)}
        onContextMenu={handleContextMenu}
        data-testid={`cell-${operatorId}-${date}`}
      >
        {(() => {
          const dayNotes = jobs.filter(j => !j.customerId && (j as any).noteType !== "dispatch_note");
          const dispatchNotes = jobs.filter(j => !j.customerId && (j as any).noteType === "dispatch_note");
          const regularJobs = jobs.filter(j => !!j.customerId);
          const cardJobs = [...dispatchNotes, ...regularJobs];
          return (
            <>
              {dayNotes.length > 0 && (
                <div className="space-y-0.5 mb-1">
                  {dayNotes.map(note => (
                    <div
                      key={`note-${note.id}`}
                      className="text-[9px] font-medium px-1.5 py-0.5 rounded-sm truncate cursor-pointer bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-200/50 dark:border-amber-700/50"
                      title={note.scope || "Note"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onJobClick(note);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCtxMenu(null);
                        setNoteCtxMenu({ x: e.clientX, y: e.clientY, noteId: note.id });
                      }}
                      data-testid={`note-sliver-${note.id}`}
                    >
                      {note.scope || "Note"}
                    </div>
                  ))}
                </div>
              )}
              {cardJobs
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((job, idx) => {
                const isAssist = assistantJobIds.has(job.id) && (job as any).assistantOperatorId === operatorId;
                return (
                <div key={`${job.id}${isAssist ? '-assist' : ''}`} onClick={(e) => { e.stopPropagation(); if (!wasContextAction()) onJobClick(job); }}>
                  <JobCard
                    job={job}
                    jobIndex={idx}
                    totalJobs={cardJobs.length}
                    sameLocationIndex={locationGroupMap[job.id]?.index}
                    sameLocationTotal={locationGroupMap[job.id]?.total}
                    isAssistantEntry={isAssist}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    onCancel={onCancel}
                    onRestore={onRestore}
                    onMoveUp={isAssist ? undefined : onMoveUp}
                    onMoveDown={isAssist ? undefined : onMoveDown}
                  />
                </div>
                );
              })}
            </>
          );
        })()}
      </div>
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          data-testid={`cell-context-menu-${operatorId}-${date}`}
        >
          {isOff ? (
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover-elevate cursor-pointer text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setCtxMenu(null);
                onRemoveOff(operatorId, date);
              }}
              data-testid={`menu-remove-off-${operatorId}-${date}`}
            >
              <CalendarOff className="w-3.5 h-3.5" />
              Remove Day Off
            </button>
          ) : (
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover-elevate cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setCtxMenu(null);
                onAddDayOff(operatorId, date);
              }}
              data-testid={`menu-add-day-off-${operatorId}-${date}`}
            >
              <CalendarOff className="w-3.5 h-3.5" />
              Add Day Off
            </button>
          )}
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover-elevate cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setCtxMenu(null);
              onPlaceHold(date, operatorId);
            }}
            data-testid={`menu-place-hold-${operatorId}-${date}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Place Hold
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover-elevate cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setCtxMenu(null);
              onAddNote(date, operatorId, "dispatch_note");
            }}
            data-testid={`menu-add-dispatch-note-${operatorId}-${date}`}
          >
            <FileText className="w-3.5 h-3.5" />
            Add Dispatch Note
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover-elevate cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setCtxMenu(null);
              onAddNote(date, operatorId, "day_note");
            }}
            data-testid={`menu-add-day-note-${operatorId}-${date}`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            Add Day Note
          </button>
        </div>
      )}
      {noteCtxMenu && (
        <div
          ref={noteCtxMenuRef}
          className="fixed z-50 min-w-[140px] rounded-md border bg-popover p-1 shadow-md"
          style={{ left: noteCtxMenu.x, top: noteCtxMenu.y }}
          data-testid={`note-context-menu-${noteCtxMenu.noteId}`}
        >
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover-elevate cursor-pointer text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              const noteJob = jobs.find(j => j.id === noteCtxMenu.noteId);
              if (noteJob) onDelete(noteJob);
              setNoteCtxMenu(null);
            }}
            data-testid={`menu-delete-note-${noteCtxMenu.noteId}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Note
          </button>
        </div>
      )}
    </DroppableDay>
  );
}

function AvailabilityChart({
  weekDays,
  jobs,
  operators,
  operatorOffDays = new Set(),
}: {
  weekDays: { date: Date; iso: string; label: string }[];
  jobs: Job[] | undefined;
  operators: Operator[] | undefined;
  operatorOffDays?: Set<string>;
}) {
  const truckOperators = operators?.filter(op => op.operatorType !== "assistant") || [];
  const totalTrucks = truckOperators.length;

  const dayStats = weekDays.map((day) => {
    const dayJobs = jobs?.filter((j) => j.scheduledDate === day.iso && j.status !== "cancelled" && j.status !== "standby") || [];
    const truckOperatorIds = new Set(truckOperators.map(op => op.id));
    const uniqueOperatorsBooked = new Set(dayJobs.map((j) => j.operatorId).filter((id): id is number => id != null && truckOperatorIds.has(id)));
    const booked = uniqueOperatorsBooked.size;
    const offCount = truckOperators.filter(op => operatorOffDays?.has(`${op.id}-${day.iso}`)).length;
    const effectiveTrucks = totalTrucks - offCount;
    const available = Math.max(0, effectiveTrucks - booked);
    const overbooked = booked > effectiveTrucks;
    const overbookedCount = booked - effectiveTrucks;
    return { ...day, booked, available, overbooked, overbookedCount, effectiveTrucks, offCount };
  });

  const todayIso = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="flex shrink-0 border-b" data-testid="availability-chart">
      <div className="w-48 shrink-0 border-r flex items-center justify-center px-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Trucks</span>
      </div>
      {dayStats.map((day) => {
        const availPct = day.effectiveTrucks > 0 ? (day.available / day.effectiveTrucks) * 100 : 0;
        const clampedPct = day.overbooked ? 100 : Math.min(availPct, 100);
        const isToday = day.iso === todayIso;
        const bookedPct = day.effectiveTrucks > 0 ? (day.booked / day.effectiveTrucks) * 100 : 0;

        return (
          <div
            key={day.iso}
            className={cn(
              "flex-1 min-w-[140px] flex items-center gap-2.5 px-3 py-1.5 border-r last:border-r-0",
              isToday && "bg-primary/[0.03]"
            )}
            data-testid={`availability-day-${day.iso}`}
          >
            <div className="flex-1 relative h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(clampedPct, 4)}%`,
                  background: day.overbooked
                    ? "hsl(0 72% 51%)"
                    : bookedPct >= 90
                      ? "hsl(38 92% 50%)"
                      : bookedPct >= 70
                        ? "hsl(38 92% 50%)"
                        : "hsl(142 71% 45%)",
                }}
                data-testid={`bar-${day.iso}`}
              />
            </div>
            <span className={cn(
              "text-xs font-bold tabular-nums shrink-0 leading-none",
              day.overbooked
                ? "text-red-600 dark:text-red-400"
                : bookedPct >= 70
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-green-600 dark:text-green-400"
            )}>
              {day.overbooked ? (
                <>{day.overbookedCount} over</>
              ) : (
                <>{day.available} open</>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

export default function Dashboard() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileCalendarView />;
  }

  return <DesktopDashboard />;
}

type UndoAction = {
  type: 'move' | 'delete' | 'status_change' | 'cancel' | 'restore';
  description: string;
  jobData: any;
  previousValues: Record<string, any>;
} | null;

function useWeatherForecast(startDate: string, endDate: string) {
  return useQuery<Map<string, { code: number; high: number; low: number }>>({
    queryKey: ["weather-forecast", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=43.0389&longitude=-87.9065&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America/Chicago&start_date=${startDate}&end_date=${endDate}`
      );
      if (!res.ok) throw new Error("Weather fetch failed");
      const data = await res.json();
      const map = new Map<string, { code: number; high: number; low: number }>();
      const { time, weather_code, temperature_2m_max, temperature_2m_min } = data.daily;
      for (let i = 0; i < time.length; i++) {
        map.set(time[i], {
          code: weather_code[i],
          high: Math.round(temperature_2m_max[i]),
          low: Math.round(temperature_2m_min[i]),
        });
      }
      return map;
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

function WeatherIcon({ code }: { code: number }) {
  if (code === 0) return <Sun className="w-3.5 h-3.5" />;
  if (code >= 1 && code <= 3) return <CloudSun className="w-3.5 h-3.5" />;
  if (code === 45 || code === 48) return <CloudFog className="w-3.5 h-3.5" />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className="w-3.5 h-3.5" />;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return <Snowflake className="w-3.5 h-3.5" />;
  if (code >= 95 && code <= 99) return <CloudLightning className="w-3.5 h-3.5" />;
  return <CloudSun className="w-3.5 h-3.5" />;
}

function DesktopDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultOperatorId, setDefaultOperatorId] = useState<number | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<string | undefined>();
  const [activeDragJob, setActiveDragJob] = useState<Job | null>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const [splitPercent, setSplitPercent] = useState(65);
  const [cancelledExpanded, setCancelledExpanded] = useState(false);
  const [standbyExpanded, setStandbyExpanded] = useState(true);
  const [holdDialog, setHoldDialog] = useState<{ open: boolean; date: string; operatorId: number }>({ open: false, date: "", operatorId: 0 });
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [timeOffDefaultOp, setTimeOffDefaultOp] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; date: string; operatorId: number; editJob?: any; noteType?: string }>({ open: false, date: "", operatorId: 0 });
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [removeOffConfirm, setRemoveOffConfirm] = useState<{ open: boolean; operatorId: number; date: string; recordId: number; startDate: string; endDate: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [focusedCell, setFocusedCell] = useState<{ operatorId: number; dayIndex: number } | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingSplit = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const setUndoWithTimeout = useCallback((action: UndoAction) => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoAction(action);
    if (action) {
      undoTimeoutRef.current = setTimeout(() => setUndoAction(null), 30000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const { data: searchResults, isLoading: searchLoading } = useQuery<any[]>({
    queryKey: [`/api/jobs/search?q=${encodeURIComponent(debouncedQuery)}`],
    enabled: debouncedQuery.length >= 2,
  });

  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const deleteJobSeries = useDeleteJobSeries();
  const moveJobSeries = useMoveJobSeries();
  const duplicateJob = useDuplicateJob();
  const { toast } = useToast();
  const [seriesDeleteConfirm, setSeriesDeleteConfirm] = useState<{ open: boolean; job: Job | null }>({ open: false, job: null });
  const [seriesMoveConfirm, setSeriesMoveConfirm] = useState<{ open: boolean; job: Job | null; newOperatorId: number; newDate: string }>({ open: false, job: null, newOperatorId: 0, newDate: "" });
  const [timeOffDetailsDialog, setTimeOffDetailsDialog] = useState<{ open: boolean; operatorId: number; date: string } | null>(null);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startDate, i);
    return { date: d, iso: format(d, "yyyy-MM-dd"), label: format(d, "EEE M/d") };
  });

  const { data: weatherData } = useWeatherForecast(weekDays[0].iso, weekDays[6].iso);

  const { data: jobs, isLoading: jobsLoading } = useJobs({
    startDate: weekDays[0].iso,
    endDate: weekDays[6].iso,
  });

  const { data: rawOperators, isLoading: opsLoading } = useOperators();
  const operators = useMemo(() => {
    if (!rawOperators) return rawOperators;
    return [...rawOperators].sort((a, b) => {
      if (a.groupName !== b.groupName) return a.groupName.localeCompare(b.groupName);
      const typeA = a.operatorType === "assistant" ? 1 : 0;
      const typeB = b.operatorType === "assistant" ? 1 : 0;
      if (typeA !== typeB) return typeA - typeB;
      const lastA = a.lastName.toLowerCase();
      const lastB = b.lastName.toLowerCase();
      if (lastA !== lastB) return lastA.localeCompare(lastB);
      return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase());
    });
  }, [rawOperators]);
  const { data: timeOffRecords } = useTimeOff({
    startDate: weekDays[0].iso,
    endDate: weekDays[6].iso,
  });
  const { data: availabilityRecords } = useAllOperatorAvailability();

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  const jobsMapRef = useRef<Record<string, Job[]>>({});
  const visibleOperatorsRef = useRef<Operator[] | undefined>(undefined);

  const collisionStrategy: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  }, []);

  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const today = () => setCurrentDate(new Date());

  const handleDragStart = (event: DragStartEvent) => {
    const job = event.active.data.current?.job;
    if (job) setActiveDragJob(job);
  };

  const handleDuplicate = useCallback((job: Job) => {
    duplicateJob.mutate(job);
  }, [duplicateJob]);

  const handleDelete = useCallback((job: Job) => {
    const seriesId = (job as any).seriesId;
    if (seriesId) {
      const futureSeriesJobs = jobs?.filter(
        (j) => (j as any).seriesId === seriesId && j.id !== job.id && j.scheduledDate > (job as any).scheduledDate
      );
      if (futureSeriesJobs && futureSeriesJobs.length > 0) {
        setSeriesDeleteConfirm({ open: true, job });
      } else {
        setUndoWithTimeout({
          type: 'delete',
          description: `deleted ${(job as any).customer?.name || "job"}`,
          jobData: job,
          previousValues: {},
        });
        deleteJob.mutate(job.id);
      }
    } else {
      setUndoWithTimeout({
        type: 'delete',
        description: `deleted ${(job as any).customer?.name || "job"}`,
        jobData: job,
        previousValues: {},
      });
      deleteJob.mutate(job.id);
    }
  }, [deleteJob, jobs, setUndoWithTimeout]);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragJob(null);
    const { active, over } = event;
    if (!over) return;

    const job = active.data.current?.job;
    const dropData = over.data.current;
    if (!job || !dropData) return;

    const { operatorId, date: dateStr, type } = dropData;
    const dropType = type || "schedule";

    if (dropType === "standby") {
      if (job.status !== "standby") {
        setUndoWithTimeout({
          type: 'move',
          description: `moved ${(job as any).customer?.name || "job"} to standby`,
          jobData: job,
          previousValues: { operatorId: job.operatorId, scheduledDate: job.scheduledDate, sortOrder: job.sortOrder, status: job.status },
        });
        await updateJob.mutateAsync({
          id: job.id,
          status: "standby",
          scheduledDate: dateStr,
        });
        toast({ title: "Moved to Standby", description: `${(job as any).customer?.name || "Job"} moved to standby` });
      }
      return;
    }

    if (dropType === "cancelled") {
      if (job.status !== "cancelled") {
        setUndoWithTimeout({
          type: 'cancel',
          description: `cancelled ${(job as any).customer?.name || "job"}`,
          jobData: job,
          previousValues: { status: job.status },
        });
        await updateJob.mutateAsync({
          id: job.id,
          status: "cancelled",
          scheduledDate: dateStr,
        });
        toast({ title: "Job Cancelled", description: `${(job as any).customer?.name || "Job"} has been cancelled` });
      }
      return;
    }

    const isAssistantDrag = active.data.current?.type === "AssistantJob";
    const targetOp = operators?.find((o: any) => o.id === operatorId);

    if (isAssistantDrag) {
      if (operatorId && dateStr && operatorOffDays.has(`${operatorId}-${dateStr}`)) {
        const opName = targetOp ? formatOperatorFullName(targetOp) : "This operator";
        toast({ title: "Cannot Assign", description: `${opName} has the day off on ${format(parseISO(dateStr), "EEE M/d")}. Remove their time off first.`, variant: "destructive" });
        return;
      }

      if (job.assistantOperatorId !== operatorId) {
        await updateJob.mutateAsync({
          id: job.id,
          assistantOperatorId: operatorId,
        });
        const opName = targetOp ? formatOperatorFullName(targetOp) : "operator";
        toast({ title: "Assistant Reassigned", description: `Assistant moved to ${opName}` });
      }
      return;
    }

    if (targetOp && ((targetOp as any).isAssistantOnly || (targetOp as any).operatorType === "assistant")) {
      toast({ title: "Cannot Assign", description: `${formatOperatorFullName(targetOp)} is an assistant operator. Assign them as an assistant on a job instead.`, variant: "destructive" });
      return;
    }

    if (operatorId && dateStr && operatorOffDays.has(`${operatorId}-${dateStr}`)) {
      const opName = targetOp ? formatOperatorFullName(targetOp) : "This operator";
      toast({ title: "Cannot Schedule", description: `${opName} has the day off on ${format(parseISO(dateStr), "EEE M/d")}. Remove their time off first.`, variant: "destructive" });
      return;
    }

    const updates: { id: number; operatorId?: number; scheduledDate?: string; sortOrder?: number; status?: string; assistantOperatorId?: number | null } = { id: job.id };
    let changed = false;

    if (job.operatorId !== operatorId || job.scheduledDate !== dateStr) {
      if (job.operatorId !== operatorId && (job as any).seriesId) {
        setSeriesMoveConfirm({ open: true, job, newOperatorId: operatorId, newDate: dateStr });
        return;
      }
      updates.operatorId = operatorId;
      updates.scheduledDate = dateStr;
      const targetKey = `${operatorId}-${dateStr}`;
      const existingJobs = jobsMap[targetKey] || [];
      const maxSort = existingJobs.reduce((max: number, j: Job) => Math.max(max, j.sortOrder ?? 0), 0);
      updates.sortOrder = maxSort + 1;
      changed = true;
    }

    if (job.status === "standby" || job.status === "cancelled") {
      updates.status = "ready";
      changed = true;
      toast({ title: "Job Restored", description: `${(job as any).customer?.name || "Job"} restored to the board as Ready` });
    }

    if (changed) {
      setUndoWithTimeout({
        type: 'move',
        description: `moved ${(job as any).customer?.name || "job"}`,
        jobData: job,
        previousValues: { operatorId: job.operatorId, scheduledDate: job.scheduledDate, sortOrder: job.sortOrder, status: job.status },
      });
      await updateJob.mutateAsync(updates);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const anyDialogOpen = isCreateOpen || !!viewingJob || seriesDeleteConfirm.open || seriesMoveConfirm.open || !!removeOffConfirm?.open || !!timeOffDetailsDialog?.open || holdDialog.open || timeOffOpen || noteDialog.open;
      if (anyDialogOpen) return;

      const ops = visibleOperatorsRef.current;
      if (!ops || ops.length === 0) return;

      if (e.key === "Escape") {
        setFocusedCell(null);
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedCell(prev => {
          if (!prev) {
            return { operatorId: ops[0].id, dayIndex: 0 };
          }
          const currentOpIdx = ops.findIndex(op => op.id === prev.operatorId);
          if (currentOpIdx === -1) return { operatorId: ops[0].id, dayIndex: 0 };

          let newOpIdx = currentOpIdx;
          let newDayIdx = prev.dayIndex;

          if (e.key === "ArrowUp") newOpIdx = Math.max(0, currentOpIdx - 1);
          if (e.key === "ArrowDown") newOpIdx = Math.min(ops.length - 1, currentOpIdx + 1);
          if (e.key === "ArrowLeft") newDayIdx = Math.max(0, prev.dayIndex - 1);
          if (e.key === "ArrowRight") newDayIdx = Math.min(6, prev.dayIndex + 1);

          return { operatorId: ops[newOpIdx].id, dayIndex: newDayIdx };
        });
        return;
      }

      if (!focusedCell) return;

      const currentDate = weekDays[focusedCell.dayIndex]?.iso;
      if (!currentDate) return;
      const cellKey = `${focusedCell.operatorId}-${currentDate}`;
      const cellJobs = jobsMapRef.current[cellKey] || [];

      if (e.key === "n") {
        e.preventDefault();
        setSelectedJob(null);
        setDefaultDate(currentDate);
        setDefaultOperatorId(focusedCell.operatorId);
        setDefaultStatus(undefined);
        setIsCreateOpen(true);
        return;
      }

      if (e.key === "d" && cellJobs.length > 0) {
        e.preventDefault();
        handleDuplicate(cellJobs[0]);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && cellJobs.length > 0) {
        e.preventDefault();
        handleDelete(cellJobs[0]);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedCell, weekDays, isCreateOpen, viewingJob, seriesDeleteConfirm.open, seriesMoveConfirm.open, removeOffConfirm?.open, timeOffDetailsDialog?.open, holdDialog.open, timeOffOpen, noteDialog.open, handleDuplicate, handleDelete]);

  const handleStatusChange = useCallback((job: Job, status: string) => {
    setUndoWithTimeout({
      type: 'status_change',
      description: `changed ${(job as any).customer?.name || "job"} status`,
      jobData: job,
      previousValues: { status: job.status },
    });
    updateJob.mutate({ id: job.id, status });
  }, [updateJob, setUndoWithTimeout]);

  const handleCancel = useCallback((job: Job) => {
    setUndoWithTimeout({
      type: 'cancel',
      description: `cancelled ${(job as any).customer?.name || "job"}`,
      jobData: job,
      previousValues: { status: job.status },
    });
    updateJob.mutate({ id: job.id, status: "cancelled" });
    toast({ title: "Job Cancelled", description: `${(job as any).customer?.name || "Job"} has been cancelled` });
  }, [updateJob, toast, setUndoWithTimeout]);

  const handleRestore = useCallback((job: Job) => {
    setUndoWithTimeout({
      type: 'restore',
      description: `restored ${(job as any).customer?.name || "job"}`,
      jobData: job,
      previousValues: { status: job.status },
    });
    updateJob.mutate({ id: job.id, status: "ready" });
    toast({ title: "Job Restored", description: `${(job as any).customer?.name || "Job"} has been restored to the board as Ready` });
  }, [updateJob, toast, setUndoWithTimeout]);

  const handleUndo = useCallback(async () => {
    if (!undoAction) return;
    try {
      if (undoAction.type === 'move') {
        await updateJob.mutateAsync({
          id: undoAction.jobData.id,
          operatorId: undoAction.previousValues.operatorId,
          scheduledDate: undoAction.previousValues.scheduledDate,
          sortOrder: undoAction.previousValues.sortOrder,
          status: undoAction.previousValues.status,
        });
      } else if (undoAction.type === 'delete') {
        const job = undoAction.jobData;
        const { id, customer, operator, createdAt, assistantOperator, creator, ...rest } = job;
        const body: Record<string, any> = {};
        const fields = ['customerId', 'operatorId', 'scheduledDate', 'scope', 'address', 'startTime', 'status', 'sortOrder', 'notes', 'seriesId', 'srNumber', 'lat', 'lng', 'assistantOperatorId', 'estimatedDuration', 'isSpot', 'noteType', 'dispatchNote', 'requestorContact', 'onSiteContact', 'billingInfo', 'poNumber', 'ticketCreated', 'manifestNeeded', 'manifestNumber', 'manifestDumpLocation', 'manifestDumpLocationName', 'scheduledDumpTimes', 'remoteHose', 'remoteHoseLength', 'remoteHoseOperatorId', 'water', 'dump', 'siteQuals', 'additionalOperatorNeeded', 'createdBy'];
        for (const f of fields) {
          if (f in rest && rest[f] !== undefined) {
            body[f] = rest[f];
          }
        }
        const res = await fetch(api.jobs.create.path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to recreate job');
        queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
      } else {
        await updateJob.mutateAsync({
          id: undoAction.jobData.id,
          status: undoAction.previousValues.status,
        });
      }
      setUndoAction(null);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      toast({ title: "Action undone" });
    } catch (err) {
      toast({ title: "Undo failed", description: (err as Error).message, variant: "destructive" });
    }
  }, [undoAction, updateJob, toast]);

  const handleReorder = useCallback(async (job: Job, direction: "up" | "down") => {
    const operatorJobs = (jobs || [])
      .filter(j => j.operatorId === job.operatorId && j.scheduledDate === job.scheduledDate && !(j as any).noteType)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const currentIndex = operatorJobs.findIndex(j => j.id === job.id);
    if (currentIndex < 0) return;

    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= operatorJobs.length) return;

    const currentSort = operatorJobs[currentIndex].sortOrder ?? currentIndex;
    const swapSort = operatorJobs[swapIndex].sortOrder ?? swapIndex;

    try {
      await fetch("/api/jobs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify([
          { id: operatorJobs[currentIndex].id, sortOrder: swapSort },
          { id: operatorJobs[swapIndex].id, sortOrder: currentSort },
        ]),
      });
      queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
    } catch (err) {
      console.error("Reorder failed", err);
    }
  }, [jobs]);

  const handlePlaceHold = useCallback((date: string, operatorId: number) => {
    setHoldDialog({ open: true, date, operatorId });
  }, []);

  const handleAddNote = useCallback((date: string, operatorId: number, noteType?: string) => {
    setNoteDialog({ open: true, date, operatorId, noteType });
  }, []);

  const removeTimeOffDay = useRemoveTimeOffDay();
  const deleteTimeOff = useDeleteTimeOff();
  const createTimeOff = useCreateTimeOff();

  const handleAddDayOff = useCallback((operatorId: number, date: string) => {
    createTimeOff.mutate({ operatorId, startDate: date, endDate: date });
  }, [createTimeOff]);

  const handleRemoveOff = useCallback(async (operatorId: number, date: string) => {
    const record = timeOffRecords?.find((r) => {
      const start = r.startDate;
      const end = r.endDate;
      return r.operatorId === operatorId && date >= start && date <= end;
    });
    if (record) {
      if (record.startDate === record.endDate) {
        deleteTimeOff.mutate(record.id);
      } else {
        setRemoveOffConfirm({ open: true, operatorId, date, recordId: record.id, startDate: record.startDate, endDate: record.endDate });
        return;
      }
    } else {
      const op = operators?.find((o) => o.id === operatorId);
      if (op?.isOutOfState) {
        const opWindows = availabilityRecords?.filter((r) => r.operatorId === operatorId) || [];
        const adjacentWindow = opWindows.find((w) => {
          const dayBefore = format(addDays(parseISO(date), -1), "yyyy-MM-dd");
          const dayAfter = format(addDays(parseISO(date), 1), "yyyy-MM-dd");
          return w.endDate === dayBefore || w.startDate === dayAfter ||
            (date >= w.startDate && date <= w.endDate);
        });
        try {
          if (adjacentWindow) {
            const newStart = date < adjacentWindow.startDate ? date : adjacentWindow.startDate;
            const newEnd = date > adjacentWindow.endDate ? date : adjacentWindow.endDate;
            const res = await fetch(`/api/operator-availability/${adjacentWindow.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ startDate: newStart, endDate: newEnd }),
              credentials: "include",
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["/api/operator-availability"] });
              toast({ title: "Availability Updated", description: `Window extended to include ${date}` });
            }
          } else {
            const res = await fetch("/api/operator-availability", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operatorId, startDate: date, endDate: date }),
              credentials: "include",
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["/api/operator-availability"] });
              toast({ title: "Availability Added", description: `Operator marked available on ${date}` });
            }
          }
        } catch {
          toast({ title: "Error", description: "Failed to update availability", variant: "destructive" });
        }
      }
    }
  }, [timeOffRecords, operators, availabilityRecords, deleteTimeOff, removeTimeOffDay, toast, queryClient]);

  const handleOffDayClick = useCallback((operatorId: number, date: string) => {
    setTimeOffDetailsDialog({ open: true, operatorId, date });
  }, []);

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplit.current = true;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingSplit.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(85, Math.max(30, pct)));
    };

    const handleMouseUp = () => {
      isDraggingSplit.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);


  const operatorOffDays = useMemo(() => {
    const offDays = new Set<string>();
    timeOffRecords?.forEach((record) => {
      let current = parseISO(record.startDate);
      const end = parseISO(record.endDate);
      while (current <= end) {
        offDays.add(`${record.operatorId}-${format(current, "yyyy-MM-dd")}`);
        current = addDays(current, 1);
      }
    });

    rawOperators?.forEach((op) => {
      if (op.isOutOfState) {
        const opAvailWindows = availabilityRecords?.filter((r) => r.operatorId === op.id) || [];
        if (opAvailWindows.length > 0) {
          weekDays.forEach((day) => {
            const dayStr = day.iso;
            const isAvailable = opAvailWindows.some(
              (w) => dayStr >= w.startDate && dayStr <= w.endDate
            );
            if (!isAvailable) {
              offDays.add(`${op.id}-${dayStr}`);
            }
          });
        } else if (op.availableFrom || op.availableTo) {
          weekDays.forEach((day) => {
            const dayStr = day.iso;
            if (op.availableFrom && dayStr < op.availableFrom) {
              offDays.add(`${op.id}-${dayStr}`);
            }
            if (op.availableTo && dayStr > op.availableTo) {
              offDays.add(`${op.id}-${dayStr}`);
            }
          });
        }
      }
    });
    return offDays;
  }, [timeOffRecords, rawOperators, availabilityRecords, weekDays]);

  const visibleOperators = useMemo(() => {
    if (!rawOperators) return rawOperators;

    const sortOp = (a: Operator, b: Operator) => {
      if (a.groupName !== b.groupName) return a.groupName.localeCompare(b.groupName);
      const typeA = a.operatorType === "assistant" ? 1 : 0;
      const typeB = b.operatorType === "assistant" ? 1 : 0;
      if (typeA !== typeB) return typeA - typeB;
      const lastA = a.lastName.toLowerCase();
      const lastB = b.lastName.toLowerCase();
      if (lastA !== lastB) return lastA.localeCompare(lastB);
      return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase());
    };

    const filtered = rawOperators.filter((op) => {
      if (!op.isOutOfState) return true;
      const allOff = weekDays.every((day) => operatorOffDays.has(`${op.id}-${day.iso}`));
      return !allOff;
    });

    const local = filtered.filter((op) => !op.isOutOfState).sort(sortOp);
    const oos = filtered.filter((op) => op.isOutOfState).sort(sortOp);

    return [...local, ...oos];
  }, [rawOperators, weekDays, operatorOffDays]);

  if (jobsLoading || opsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const jobsMap: Record<string, Job[]> = {};
  const cancelledByDay: Record<string, Job[]> = {};
  const standbyByDay: Record<string, Job[]> = {};
  const assistantJobIds = new Set<number>();
  jobs?.forEach(job => {
    if (job.status === "cancelled") {
      const dayKey = job.scheduledDate;
      if (!cancelledByDay[dayKey]) cancelledByDay[dayKey] = [];
      cancelledByDay[dayKey].push(job);
      return;
    }
    if (job.status === "standby") {
      const dayKey = job.scheduledDate;
      if (!standbyByDay[dayKey]) standbyByDay[dayKey] = [];
      standbyByDay[dayKey].push(job);
      return;
    }
    if (!job.operatorId) return;
    const key = `${job.operatorId}-${job.scheduledDate}`;
    if (!jobsMap[key]) jobsMap[key] = [];
    jobsMap[key].push(job);
    if ((job as any).assistantOperatorId) {
      const assistKey = `${(job as any).assistantOperatorId}-${job.scheduledDate}`;
      if (!jobsMap[assistKey]) jobsMap[assistKey] = [];
      jobsMap[assistKey].push(job);
      assistantJobIds.add(job.id);
    }
  });
  Object.values(jobsMap).forEach(arr => arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
  jobsMapRef.current = jobsMap;
  visibleOperatorsRef.current = visibleOperators;

  const locationGroupMap: Record<number, { index: number; total: number }> = {};
  if (jobs) {
    const byDateAddr: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (job.status === "cancelled" || !job.address) continue;
      const key = `${job.scheduledDate}::${job.address.trim().toLowerCase()}`;
      if (!byDateAddr[key]) byDateAddr[key] = [];
      byDateAddr[key].push(job);
    }
    for (const group of Object.values(byDateAddr)) {
      if (group.length > 1) {
        group.forEach((job, idx) => {
          locationGroupMap[job.id] = { index: idx, total: group.length };
        });
      }
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-muted/30">
      <div className="px-6 py-3 flex items-center justify-between gap-4 border-b bg-card">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-display font-bold text-foreground">
            Scheduling Board
          </h1>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button variant="ghost" size="icon" onClick={prevWeek} className="h-8 w-8" data-testid="button-prev-week">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={today} className="text-xs font-medium px-3 h-8" data-testid="button-today">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={nextWeek} className="h-8 w-8" data-testid="button-next-week">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {format(startDate, "MMMM yyyy")}
          </span>
          <Input
            type="date"
            className="w-40"
            value={format(currentDate, "yyyy-MM-dd")}
            onChange={(e) => {
              if (e.target.value) {
                setCurrentDate(parseISO(e.target.value));
              }
            }}
            data-testid="input-jump-to-date"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                data-testid="button-keyboard-shortcuts"
              >
                <Keyboard className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="text-sm font-semibold mb-2">Keyboard Shortcuts</div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Navigate cells</span><span className="font-mono text-foreground">Arrow keys</span></div>
                <div className="flex justify-between"><span>New job</span><span className="font-mono text-foreground">N</span></div>
                <div className="flex justify-between"><span>Duplicate job</span><span className="font-mono text-foreground">D</span></div>
                <div className="flex justify-between"><span>Delete job</span><span className="font-mono text-foreground">Del / Backspace</span></div>
                <div className="flex justify-between"><span>Clear focus</span><span className="font-mono text-foreground">Esc</span></div>
              </div>
            </PopoverContent>
          </Popover>
          {undoAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              data-testid="button-undo"
            >
              <Undo2 className="w-4 h-4 mr-1.5" />
              <span className="text-xs truncate max-w-[150px]">Undo: {undoAction.description}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) { setSearchQuery(""); setDebouncedQuery(""); }
            }}
            data-testid="button-search"
          >
            <Search className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setTimeOffDefaultOp(null); setTimeOffOpen(true); }}
            data-testid="button-time-off"
          >
            <CalendarOff className="w-4 h-4 mr-2" />
            Time Off
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMapVisible(!mapVisible)}
            data-testid="button-toggle-map"
          >
            {mapVisible ? <PanelRightClose className="w-4 h-4 mr-2" /> : <PanelRightOpen className="w-4 h-4 mr-2" />}
            Map
          </Button>
          <Button onClick={() => { setSelectedJob(null); setDefaultDate(undefined); setDefaultOperatorId(null); setDefaultStatus(undefined); setIsCreateOpen(true); }} className="shadow-lg shadow-primary/20" data-testid="button-new-job">
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-b bg-card px-6 py-3" data-testid="search-panel">
          <div className="max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search jobs by customer, operator, address, scope, PO number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
                data-testid="input-search"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setDebouncedQuery(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  data-testid="button-clear-search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {debouncedQuery.length >= 2 && (
              <div className="mt-2 max-h-80 overflow-y-auto rounded-md border bg-background" data-testid="search-results">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <div className="divide-y">
                    {searchResults.map((job: any) => {
                      const statusInfo = STATUS_COLORS[job.status] || { hex: "#9ca3af", label: job.status };
                      return (
                        <button
                          key={job.id}
                          className="w-full text-left px-4 py-2.5 hover-elevate flex items-start gap-3"
                          onClick={() => {
                            setCurrentDate(parseISO(job.scheduledDate));
                            setSearchOpen(false);
                            setSearchQuery("");
                            setDebouncedQuery("");
                          }}
                          data-testid={`search-result-${job.id}`}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                            style={{ background: statusInfo.hex }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {job.customer?.name || "Unknown Customer"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(job.scheduledDate), "EEE, MMM d, yyyy")}
                              </span>
                              {job.startTime && (
                                <span className="text-xs text-muted-foreground">
                                  {job.startTime}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                              {job.operator && (
                                <span>{formatOperatorShortName(job.operator)}</span>
                              )}
                              {job.scope && (
                                <span className="truncate max-w-[300px]">{job.scope}</span>
                              )}
                            </div>
                            {job.address && (
                              <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                                {job.address}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground" data-testid="text-no-results">
                    No jobs found for "{debouncedQuery}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <DndContext 
        sensors={sensors} 
        collisionDetection={collisionStrategy}
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        <div ref={containerRef} className="flex-1 overflow-hidden flex">
          <div
            className="flex flex-col overflow-hidden"
            style={{ width: mapVisible ? `${splitPercent}%` : "100%" }}
          >
            <AvailabilityChart weekDays={weekDays} jobs={jobs} operators={visibleOperators} operatorOffDays={operatorOffDays} />
            <div className="flex border-b bg-muted/50">
              <div className="w-48 shrink-0 p-4 font-semibold text-sm border-r bg-muted/50 sticky left-0 z-10 flex items-center">
                Operators
              </div>
              {weekDays.map((day) => {
                const weather = weatherData?.get(day.iso);
                return (
                  <div 
                    key={day.iso} 
                    className={cn(
                      "flex-1 min-w-[140px] p-3 text-center border-r last:border-r-0",
                      day.iso === format(new Date(), "yyyy-MM-dd") && "bg-primary/5"
                    )}
                  >
                    <div className="font-semibold text-sm">{day.label}</div>
                    {weather && (
                      <div
                        className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-0.5"
                        data-testid={`weather-${day.iso}`}
                      >
                        <WeatherIcon code={weather.code} />
                        <span>{weather.high}°/{weather.low}°</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <ScrollArea className="flex-1 custom-scrollbar">
              <div className="min-w-fit">
                {(() => {
                  let lastGroup = "";
                  let lastType = "";
                  let lastOosRegion = "";
                  let rowIndex = 0;
                  return visibleOperators?.map((operator) => {
                    const isOos = operator.isOutOfState;
                    const virtualGroup = isOos ? "Out of State" : operator.groupName;
                    const showGroupHeader = virtualGroup !== lastGroup;
                    if (showGroupHeader) { rowIndex = 0; lastType = ""; lastOosRegion = ""; }
                    const currentGroup = virtualGroup;
                    const isAssistant = operator.operatorType === "assistant";
                    const showAssistantDivider = !isOos && !showGroupHeader && isAssistant && lastType !== "assistant";
                    const showOosRegionHeader = isOos && !showGroupHeader && operator.groupName !== lastOosRegion;
                    if (isOos) lastOosRegion = operator.groupName;
                    if (showGroupHeader && isOos) lastOosRegion = operator.groupName;
                    lastGroup = currentGroup;
                    lastType = operator.operatorType || "";
                    const isCollapsed = collapsedGroups.has(currentGroup);
                    if (showAssistantDivider || showOosRegionHeader) rowIndex = 0;
                    const isEven = rowIndex % 2 === 0;
                    rowIndex++;
                    return (
                      <div key={operator.id}>
                        {showGroupHeader && (
                          <div 
                            className="flex border-b bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                            onClick={() => toggleGroup(currentGroup)}
                            data-testid={`group-header-${currentGroup}`}
                          >
                            <div className="w-48 shrink-0 px-3 py-1.5 border-r sticky left-0 z-10 bg-muted/40 flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{currentGroup}</span>
                            </div>
                            {weekDays.map((day) => (
                              <div key={day.iso} className="flex-1 min-w-[140px] border-r last:border-r-0" />
                            ))}
                          </div>
                        )}
                        {!isCollapsed && showAssistantDivider && (
                          <div className="flex border-b bg-muted/20" data-testid={`assistant-divider-${currentGroup}`}>
                            <div className="w-48 shrink-0 px-3 py-1 border-r sticky left-0 z-10 bg-muted/20 flex items-center gap-2">
                              <div className="w-2" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Assistants</span>
                            </div>
                            {weekDays.map((day) => (
                              <div key={day.iso} className="flex-1 min-w-[140px] border-r last:border-r-0" />
                            ))}
                          </div>
                        )}
                        {!isCollapsed && isOos && (showGroupHeader || showOosRegionHeader) && (
                          <div className="flex border-b bg-amber-50/50 dark:bg-amber-950/20" data-testid={`oos-region-${operator.groupName}`}>
                            <div className="w-48 shrink-0 px-3 py-1 border-r sticky left-0 z-10 bg-amber-50/50 dark:bg-amber-950/20 flex items-center gap-2">
                              <div className="w-2" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70">{operator.groupName}</span>
                            </div>
                            {weekDays.map((day) => (
                              <div key={day.iso} className="flex-1 min-w-[140px] border-r last:border-r-0" />
                            ))}
                          </div>
                        )}
                        {!isCollapsed && (
                        <div className="flex border-b last:border-b-0">
                          <div className={cn(
                            "w-48 shrink-0 px-3 py-2.5 border-r sticky left-0 z-10 flex flex-col justify-center group hover:bg-muted/50 transition-colors",
                            isEven ? "bg-muted/30" : "bg-card"
                          )}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-10 rounded-full shrink-0" 
                                style={{ backgroundColor: getOperatorColor(operator) }} 
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-sm leading-tight truncate">{formatOperatorShortName(operator)}</div>
                                {operator.phone && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{operator.phone}</div>
                                )}
                              </div>
                            </div>
                          </div>

                    {weekDays.map((day) => {
                      const key = `${operator.id}-${day.iso}`;
                      const cellJobs = jobsMap[key] || [];
                      const isOff = operatorOffDays.has(key);
                      
                      return (
                        <div key={day.iso} className="flex-1 min-w-[140px]">
                          <DayCell 
                            date={day.iso} 
                            operatorId={operator.id} 
                            jobs={cellJobs}
                            locationGroupMap={locationGroupMap}
                            assistantJobIds={assistantJobIds}
                            onJobClick={(job) => setViewingJob(job)}
                            onDuplicate={handleDuplicate}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                            onCancel={handleCancel}
                            onRestore={handleRestore}
                            onCellClick={(date, opId) => { setSelectedJob(null); setDefaultDate(date); setDefaultOperatorId(opId); setDefaultStatus(undefined); setIsCreateOpen(true); }}
                            onPlaceHold={handlePlaceHold}
                            onAddNote={handleAddNote}
                            onRemoveOff={handleRemoveOff}
                            onOffDayClick={handleOffDayClick}
                            onAddDayOff={handleAddDayOff}
                            onMoveUp={(job) => handleReorder(job, "up")}
                            onMoveDown={(job) => handleReorder(job, "down")}
                            isEvenRow={isEven}
                            isOff={isOff}
                            isFocused={focusedCell?.operatorId === operator.id && weekDays[focusedCell?.dayIndex]?.iso === day.iso}
                          />
                        </div>
                      );
                    })}
                        </div>
                        )}
                      </div>
                    );
                  });
                })()}

                {/* Standby / 2nd Jobs Row */}
                <div className="flex border-b bg-purple-50/50 dark:bg-purple-950/20">
                  <div 
                    className="w-48 shrink-0 px-3 py-2 border-r sticky left-0 z-10 bg-purple-50/50 dark:bg-purple-950/20 cursor-pointer"
                    onClick={() => setStandbyExpanded(!standbyExpanded)}
                    data-testid="button-toggle-standby"
                  >
                    <div className="flex items-center gap-2">
                      {standbyExpanded ? <ChevronUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                      <Clock3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <div>
                        <div className="text-xs font-bold text-purple-700 dark:text-purple-300">2nd Jobs / Standby</div>
                        <div className="text-[10px] text-purple-600/70 dark:text-purple-400/70">
                          {weekDays.reduce((sum, day) => sum + (standbyByDay[day.iso]?.length || 0), 0)} total
                        </div>
                      </div>
                    </div>
                  </div>
                  {weekDays.map((day) => {
                    const dayStandby = standbyByDay[day.iso] || [];
                    return (
                      <DroppableDay
                        key={day.iso}
                        id={`standby-${day.iso}`}
                        date={day.iso}
                        operatorId={0}
                        type="standby"
                        className="flex-1 min-w-[140px] p-1.5 border-r last:border-r-0"
                      >
                        <div
                          className="min-h-[40px] cursor-pointer"
                          data-testid={`standby-cell-${day.iso}`}
                          onClick={() => {
                            setSelectedJob(null);
                            setDefaultDate(day.iso);
                            setDefaultOperatorId(null);
                            setDefaultStatus("standby");
                            setIsCreateOpen(true);
                          }}
                        >
                          {standbyExpanded && dayStandby.map((job) => (
                            <div key={job.id} onClick={(e) => { e.stopPropagation(); setViewingJob(job); }}>
                              <JobCard
                                job={job}
                                sameLocationIndex={locationGroupMap[job.id]?.index}
                                sameLocationTotal={locationGroupMap[job.id]?.total}
                                onDuplicate={handleDuplicate}
                                onDelete={handleDelete}
                                onStatusChange={handleStatusChange}
                                onCancel={handleCancel}
                                onRestore={handleRestore}
                              />
                            </div>
                          ))}
                          {!standbyExpanded && dayStandby.length > 0 && (
                            <div className="text-center">
                              <Badge variant="secondary" className="text-[10px]">{dayStandby.length} standby</Badge>
                            </div>
                          )}
                        </div>
                      </DroppableDay>
                    );
                  })}
                </div>

                {/* Cancelled Jobs Bucket */}
                <div className="flex border-b bg-muted/60">
                  <div 
                    className="w-48 shrink-0 px-3 py-2 border-r sticky left-0 z-10 bg-muted/60 cursor-pointer"
                    onClick={() => setCancelledExpanded(!cancelledExpanded)}
                    data-testid="button-toggle-cancelled"
                  >
                    <div className="flex items-center gap-2">
                      {cancelledExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      <Ban className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs font-bold text-muted-foreground">Cancelled</div>
                        <div className="text-[10px] text-muted-foreground/70">
                          {weekDays.reduce((sum, day) => sum + (cancelledByDay[day.iso]?.length || 0), 0)} total
                        </div>
                      </div>
                    </div>
                  </div>
                  {weekDays.map((day) => {
                    const dayCancelled = cancelledByDay[day.iso] || [];
                    return (
                      <DroppableDay
                        key={day.iso}
                        id={`cancelled-${day.iso}`}
                        date={day.iso}
                        operatorId={0}
                        type="cancelled"
                        className="flex-1 min-w-[140px] p-1.5 border-r last:border-r-0"
                      >
                        <div data-testid={`cancelled-cell-${day.iso}`}>
                          <div className="text-center mb-1">
                            {dayCancelled.length > 0 && (
                              <Badge variant="secondary" className="text-[10px]" data-testid={`badge-cancelled-count-${day.iso}`}>
                                <Ban className="w-3 h-3 mr-1" />
                                {dayCancelled.length} truck{dayCancelled.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          {cancelledExpanded && dayCancelled.map((job) => (
                            <div key={job.id} className="opacity-60" onClick={() => setViewingJob(job)}>
                              <JobCard
                                job={job}
                                onDuplicate={handleDuplicate}
                                onDelete={handleDelete}
                                onStatusChange={handleStatusChange}
                                onCancel={handleCancel}
                                onRestore={handleRestore}
                              />
                            </div>
                          ))}
                        </div>
                      </DroppableDay>
                    );
                  })}
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {mapVisible && (
            <>
              <div
                className="w-1.5 bg-border hover:bg-primary/30 cursor-col-resize flex-shrink-0 relative group transition-colors"
                onMouseDown={handleSplitMouseDown}
                data-testid="panel-resizer"
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-muted-foreground/30 group-hover:bg-primary/60 transition-colors" />
              </div>

              <div
                className="flex flex-col overflow-hidden border-l"
                style={{ width: `${100 - splitPercent}%` }}
                data-testid="map-panel"
              >
                <DashboardMapPanel 
                  operators={visibleOperators} 
                  jobs={jobs} 
                  weekStart={format(startDate, "yyyy-MM-dd")}
                  weekEnd={format(addDays(startDate, 6), "yyyy-MM-dd")}
                />
              </div>
            </>
          )}
        </div>

        <DragOverlay>
          {activeDragJob && (
            <div className="w-[180px]">
              <JobCard job={activeDragJob} isOverlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <CreateJobDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen}
        initialData={selectedJob}
        defaultDate={defaultDate}
        defaultOperatorId={defaultOperatorId}
        defaultStatus={defaultStatus}
      />

      <PlaceHoldDialog
        open={holdDialog.open}
        onOpenChange={(open) => setHoldDialog(prev => ({ ...prev, open }))}
        date={holdDialog.date}
        operatorId={holdDialog.operatorId}
      />

      <TimeOffDialog
        open={timeOffOpen}
        onOpenChange={setTimeOffOpen}
        defaultOperatorId={timeOffDefaultOp}
      />

      <JobDetailsDialog
        job={viewingJob}
        open={!!viewingJob}
        onOpenChange={(open) => { if (!open) setViewingJob(null); }}
        onEdit={(job) => {
          setViewingJob(null);
          if (!job.customerId) {
            setNoteDialog({ open: true, date: job.scheduledDate, operatorId: job.operatorId || 0, editJob: job, noteType: (job as any).noteType });
          } else {
            setSelectedJob(job); setDefaultDate(undefined); setDefaultOperatorId(null); setDefaultStatus(undefined); setIsCreateOpen(true);
          }
        }}
      />

      <DispatchNoteDialog
        open={noteDialog.open}
        onOpenChange={(open) => setNoteDialog(prev => ({ ...prev, open }))}
        date={noteDialog.date}
        operatorId={noteDialog.operatorId}
        editJob={noteDialog.editJob}
        noteType={noteDialog.noteType}
      />

      <AlertDialog open={!!removeOffConfirm?.open} onOpenChange={(open) => { if (!open) setRemoveOffConfirm(null); }}>
        <AlertDialogContent onWheel={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Time Off</AlertDialogTitle>
            <AlertDialogDescription>
              This day is part of a time-off period ({removeOffConfirm ? format(parseISO(removeOffConfirm.startDate), "MMM d") : ""} - {removeOffConfirm ? format(parseISO(removeOffConfirm.endDate), "MMM d") : ""}). Would you like to remove just this day or the entire time-off period?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="btn-cancel-remove-off">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-remove-single-day"
              onClick={() => {
                if (removeOffConfirm) {
                  removeTimeOffDay.mutate({ id: removeOffConfirm.recordId, date: removeOffConfirm.date });
                  setRemoveOffConfirm(null);
                }
              }}
            >
              Remove This Day Only
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              data-testid="btn-remove-entire-series"
              onClick={() => {
                if (removeOffConfirm) {
                  deleteTimeOff.mutate(removeOffConfirm.recordId);
                  setRemoveOffConfirm(null);
                }
              }}
            >
              Remove Entire Time Off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={seriesDeleteConfirm.open} onOpenChange={(open) => { if (!open) setSeriesDeleteConfirm({ open: false, job: null }); }}>
        <AlertDialogContent onWheel={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Series Event</AlertDialogTitle>
            <AlertDialogDescription>
              This job is part of a series. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="btn-cancel-series-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-delete-single-event"
              onClick={() => {
                if (seriesDeleteConfirm.job) {
                  deleteJob.mutate(seriesDeleteConfirm.job.id);
                  setSeriesDeleteConfirm({ open: false, job: null });
                }
              }}
            >
              Delete This Event Only
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              data-testid="btn-delete-series-following"
              onClick={() => {
                if (seriesDeleteConfirm.job) {
                  const job = seriesDeleteConfirm.job;
                  deleteJobSeries.mutate({ seriesId: (job as any).seriesId, fromDate: job.scheduledDate });
                  setSeriesDeleteConfirm({ open: false, job: null });
                }
              }}
            >
              Delete This & Following
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={seriesMoveConfirm.open} onOpenChange={(open) => { if (!open) setSeriesMoveConfirm({ open: false, job: null, newOperatorId: 0, newDate: "" }); }}>
        <AlertDialogContent onWheel={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Move Series Event</AlertDialogTitle>
            <AlertDialogDescription>
              This job is part of a series. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="btn-cancel-series-move">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-move-single-day"
              onClick={async () => {
                if (seriesMoveConfirm.job) {
                  const job = seriesMoveConfirm.job;
                  const operatorId = seriesMoveConfirm.newOperatorId;
                  const dateStr = seriesMoveConfirm.newDate;
                  const targetKey = `${operatorId}-${dateStr}`;
                  const existingJobs = jobsMap[targetKey] || [];
                  const maxSort = existingJobs.reduce((max: number, j: Job) => Math.max(max, j.sortOrder ?? 0), 0);
                  const updates: any = { id: job.id, operatorId, scheduledDate: dateStr, sortOrder: maxSort + 1 };
                  if (job.status === "standby" || job.status === "cancelled") {
                    updates.status = "ready";
                  }
                  await updateJob.mutateAsync(updates);
                  setSeriesMoveConfirm({ open: false, job: null, newOperatorId: 0, newDate: "" });
                }
              }}
            >
              Move This Day Only
            </AlertDialogAction>
            <AlertDialogAction
              data-testid="btn-move-entire-series"
              onClick={() => {
                if (seriesMoveConfirm.job) {
                  const job = seriesMoveConfirm.job;
                  moveJobSeries.mutate({ seriesId: (job as any).seriesId, operatorId: seriesMoveConfirm.newOperatorId, fromDate: job.scheduledDate });
                  setSeriesMoveConfirm({ open: false, job: null, newOperatorId: 0, newDate: "" });
                }
              }}
            >
              Move Entire Series
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!timeOffDetailsDialog?.open} onOpenChange={(open) => { if (!open) setTimeOffDetailsDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Time Off Details</DialogTitle>
            <DialogDescription>
              {(() => {
                if (!timeOffDetailsDialog) return "";
                const op = operators?.find((o) => o.id === timeOffDetailsDialog.operatorId);
                return op ? `${formatOperatorFullName(op)}` : "Operator";
              })()}
            </DialogDescription>
          </DialogHeader>
          {timeOffDetailsDialog && (() => {
            const record = timeOffRecords?.find((r) =>
              r.operatorId === timeOffDetailsDialog.operatorId &&
              timeOffDetailsDialog.date >= r.startDate &&
              timeOffDetailsDialog.date <= r.endDate
            );
            const op = operators?.find((o) => o.id === timeOffDetailsDialog.operatorId);
            const isOosUnavailable = !record && op?.isOutOfState;
            return (
              <div className="space-y-3" data-testid="time-off-details-content">
                {record ? (
                  <>
                    <div className="text-sm">
                      <span className="font-medium">Dates: </span>
                      {format(parseISO(record.startDate), "MMM d, yyyy")}
                      {record.startDate !== record.endDate && ` - ${format(parseISO(record.endDate), "MMM d, yyyy")}`}
                    </div>
                    {record.reason && (
                      <div className="text-sm">
                        <span className="font-medium">Reason: </span>
                        {record.reason}
                      </div>
                    )}
                  </>
                ) : isOosUnavailable ? (
                  <div className="text-sm text-muted-foreground">
                    This operator is out of state and not available on this date.
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No time-off record found for this date.
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {timeOffDetailsDialog && (() => {
              const record = timeOffRecords?.find((r) =>
                r.operatorId === timeOffDetailsDialog.operatorId &&
                timeOffDetailsDialog.date >= r.startDate &&
                timeOffDetailsDialog.date <= r.endDate
              );
              if (record) {
                return (
                  <Button
                    variant="destructive"
                    data-testid="btn-remove-time-off-from-details"
                    onClick={() => {
                      handleRemoveOff(timeOffDetailsDialog.operatorId, timeOffDetailsDialog.date);
                      setTimeOffDetailsDialog(null);
                    }}
                  >
                    Remove Time Off
                  </Button>
                );
              }
              return null;
            })()}
            <Button
              variant="outline"
              data-testid="btn-close-time-off-details"
              onClick={() => setTimeOffDetailsDialog(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
