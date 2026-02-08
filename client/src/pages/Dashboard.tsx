import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, endOfWeek, parseISO } from "date-fns";
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
import { useJobs, useUpdateJob, useDeleteJob, useDuplicateJob } from "@/hooks/use-jobs";
import { queryClient } from "@/lib/queryClient";
import { useOperators } from "@/hooks/use-operators";
import { JobCard, wasContextAction } from "@/components/JobCard";
import { CreateJobDialog } from "@/components/CreateJobDialog";
import { PlaceHoldDialog } from "@/components/PlaceHoldDialog";
import { TimeOffDialog } from "@/components/TimeOffDialog";
import { JobDetailsDialog } from "@/components/JobDetailsDialog";
import { DispatchNoteDialog } from "@/components/DispatchNoteDialog";
import { useTimeOff, useRemoveTimeOffDay, useDeleteTimeOff } from "@/hooks/use-time-off";
import { ChevronLeft, ChevronRight, Plus, Loader2, MapPin, Truck, PanelRightClose, PanelRightOpen, Ban, ChevronDown, ChevronUp, Clock3, RotateCcw, CalendarOff, StickyNote, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOperatorColor } from "@/lib/operator-colors";
import type { Job, Customer, Operator } from "@shared/schema";
import { DroppableDay } from "@/components/DroppableDay";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMapsReady } from "@/components/AddressAutocomplete";

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

const DEFAULT_CENTER: [number, number] = [43.0389, -87.9065];

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function createJobMarkerSvg(color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="3"/></svg>`)}`;
}

function createTruckMarkerSvg(color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect x="2" y="2" width="24" height="24" rx="4" fill="${color}" stroke="white" stroke-width="3"/><g transform="translate(6,6)"><path d="M10 14V4a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 1 4v8.25a.75.75 0 0 0 .75.75h1.5" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.25 14H6.75" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M14.25 14h1.5a.75.75 0 0 0 .75-.75v-2.74a.75.75 0 0 0-.165-.468l-2.61-3.26A.75.75 0 0 0 13.14 6.5H10.5" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12.75" cy="14" r="1.5" fill="none" stroke="white" stroke-width="1.5"/><circle cx="5.25" cy="14" r="1.5" fill="none" stroke="white" stroke-width="1.5"/></g></svg>`)}`;
}

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
  isEvenRow,
  isOff,
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
  onAddNote: (date: string, operatorId: number) => void,
  onRemoveOff: (operatorId: number, date: string) => void,
  isEvenRow?: boolean,
  isOff?: boolean,
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-testid^="card-job-"]')) return;
    e.preventDefault();
    e.stopPropagation();
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
          : isEvenRow ? "bg-muted/30" : "bg-card/50"
      )}
    >
      {isOff && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer z-[1]"
          style={{
            backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(239,68,68,0.15) 8px, rgba(239,68,68,0.15) 10px)",
          }}
          onClick={(e) => { e.stopPropagation(); }}
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
        {jobs
          .slice()
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((job, idx) => {
          const isAssist = assistantJobIds.has(job.id) && (job as any).assistantOperatorId === operatorId;
          return (
          <div key={`${job.id}${isAssist ? '-assist' : ''}`} onClick={(e) => { e.stopPropagation(); if (!wasContextAction()) onJobClick(job); }}>
            <JobCard
              job={job}
              jobIndex={idx}
              totalJobs={jobs.length}
              sameLocationIndex={locationGroupMap[job.id]?.index}
              sameLocationTotal={locationGroupMap[job.id]?.total}
              isAssistantEntry={isAssist}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onCancel={onCancel}
              onRestore={onRestore}
            />
          </div>
          );
        })}
      </div>
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          data-testid={`cell-context-menu-${operatorId}-${date}`}
        >
          {isOff && (
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
              onAddNote(date, operatorId);
            }}
            data-testid={`menu-add-note-${operatorId}-${date}`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            Add Dispatch Note
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
  const totalTrucks = operators?.length || 0;

  const dayStats = weekDays.map((day) => {
    const dayJobs = jobs?.filter((j) => j.scheduledDate === day.iso && j.status !== "cancelled" && j.status !== "standby") || [];
    const uniqueOperatorsBooked = new Set(dayJobs.map((j) => j.operatorId).filter(Boolean));
    const booked = uniqueOperatorsBooked.size;
    const offCount = operators?.filter(op => operatorOffDays?.has(`${op.id}-${day.iso}`)).length || 0;
    const effectiveTrucks = totalTrucks - offCount;
    const available = Math.max(0, effectiveTrucks - booked);
    const overbooked = booked > effectiveTrucks;
    const overbookedCount = booked - effectiveTrucks;
    return { ...day, booked, available, overbooked, overbookedCount, effectiveTrucks, offCount };
  });

  return (
    <div className="border-t bg-card shrink-0" data-testid="availability-chart">
      <div className="flex items-end">
        <div className="w-48 shrink-0 px-3 py-2 flex items-end justify-center">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Availability</span>
        </div>
        {dayStats.map((day) => {
          const availableRatio = day.effectiveTrucks > 0 ? day.available / day.effectiveTrucks : 0;
          const barHeight = day.overbooked ? 100 : Math.max(6, availableRatio * 100);

          return (
            <div key={day.iso} className="flex-1 min-w-[140px] flex flex-col items-center gap-0.5 py-1.5" data-testid={`availability-day-${day.iso}`}>
              <div className="relative w-full flex flex-col items-center" style={{ height: "36px" }}>
                <div
                  className="absolute bottom-0 w-full max-w-[40px] rounded-sm transition-all duration-300"
                  style={{
                    height: `${barHeight}%`,
                    background: day.overbooked
                      ? "hsl(0, 84%, 60%)"
                      : day.available === 0
                        ? "hsl(40, 96%, 50%)"
                        : "hsl(142, 71%, 45%)",
                    opacity: day.overbooked ? 1 : 0.85,
                  }}
                  data-testid={`bar-${day.iso}`}
                />
              </div>
              <div className={cn(
                "text-[11px] font-bold leading-tight",
                day.overbooked ? "text-destructive" : day.available === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
              )}>
                {day.overbooked ? (
                  <span>{day.overbookedCount} over</span>
                ) : (
                  <span>{day.available}/{day.effectiveTrucks}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
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

function DesktopDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultOperatorId, setDefaultOperatorId] = useState<number | null>(null);
  const [activeDragJob, setActiveDragJob] = useState<Job | null>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const [splitPercent, setSplitPercent] = useState(65);
  const [cancelledExpanded, setCancelledExpanded] = useState(false);
  const [standbyExpanded, setStandbyExpanded] = useState(true);
  const [holdDialog, setHoldDialog] = useState<{ open: boolean; date: string; operatorId: number }>({ open: false, date: "", operatorId: 0 });
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [timeOffDefaultOp, setTimeOffDefaultOp] = useState<number | null>(null);
  const [mapDate, setMapDate] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; date: string; operatorId: number; editJob?: any }>({ open: false, date: "", operatorId: 0 });
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const isDraggingSplit = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const duplicateJob = useDuplicateJob();
  const { toast } = useToast();

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<google.maps.Map | null>(null);
  const googleMarkers = useRef<google.maps.Marker[]>([]);
  const googleInfoWindow = useRef<google.maps.InfoWindow | null>(null);
  const mapsReady = useGoogleMapsReady();

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startDate, i);
    return { date: d, iso: format(d, "yyyy-MM-dd"), label: format(d, "EEE M/d") };
  });

  const { data: jobs, isLoading: jobsLoading } = useJobs({
    startDate: weekDays[0].iso,
    endDate: weekDays[6].iso,
  });

  const { data: operators, isLoading: opsLoading } = useOperators();
  const { data: timeOffRecords } = useTimeOff({
    startDate: weekDays[0].iso,
    endDate: weekDays[6].iso,
  });

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

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
        await updateJob.mutateAsync({
          id: job.id,
          status: "cancelled",
          scheduledDate: dateStr,
        });
        toast({ title: "Job Cancelled", description: `${(job as any).customer?.name || "Job"} has been cancelled` });
      }
      return;
    }

    const targetOp = operators?.find((o: any) => o.id === operatorId);
    if (targetOp && (targetOp as any).isAssistantOnly) {
      toast({ title: "Cannot Assign", description: `${targetOp.name} is an assistant-only operator. Assign them as an assistant on a job instead.`, variant: "destructive" });
      return;
    }

    if (operatorId && dateStr && operatorOffDays.has(`${operatorId}-${dateStr}`)) {
      const opName = targetOp?.name || "This operator";
      toast({ title: "Cannot Schedule", description: `${opName} has the day off on ${format(parseISO(dateStr), "EEE M/d")}. Remove their time off first.`, variant: "destructive" });
      return;
    }

    const updates: { id: number; operatorId?: number; scheduledDate?: string; sortOrder?: number; status?: string } = { id: job.id };
    let changed = false;

    if (job.operatorId !== operatorId || job.scheduledDate !== dateStr) {
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
      await updateJob.mutateAsync(updates);
    }
  };

  const handleDuplicate = useCallback((job: Job) => {
    duplicateJob.mutate(job);
  }, [duplicateJob]);

  const handleDelete = useCallback((job: Job) => {
    deleteJob.mutate(job.id);
  }, [deleteJob]);

  const handleStatusChange = useCallback((job: Job, status: string) => {
    updateJob.mutate({ id: job.id, status });
  }, [updateJob]);

  const handleCancel = useCallback((job: Job) => {
    updateJob.mutate({ id: job.id, status: "cancelled" });
    toast({ title: "Job Cancelled", description: `${(job as any).customer?.name || "Job"} has been cancelled` });
  }, [updateJob, toast]);

  const handleRestore = useCallback((job: Job) => {
    updateJob.mutate({ id: job.id, status: "ready" });
    toast({ title: "Job Restored", description: `${(job as any).customer?.name || "Job"} has been restored to the board as Ready` });
  }, [updateJob, toast]);

  const handlePlaceHold = useCallback((date: string, operatorId: number) => {
    setHoldDialog({ open: true, date, operatorId });
  }, []);

  const handleAddNote = useCallback((date: string, operatorId: number) => {
    setNoteDialog({ open: true, date, operatorId });
  }, []);

  const removeTimeOffDay = useRemoveTimeOffDay();
  const deleteTimeOff = useDeleteTimeOff();

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
        removeTimeOffDay.mutate({ id: record.id, date });
      }
    } else {
      const op = operators?.find((o) => o.id === operatorId);
      if (op?.isOutOfState) {
        const updates: Record<string, string> = {};
        if (op.availableFrom && date < op.availableFrom) {
          updates.availableFrom = date;
        }
        if (op.availableTo && date > op.availableTo) {
          updates.availableTo = date;
        }
        if (!op.availableFrom && op.availableTo && date > op.availableTo) {
          updates.availableTo = date;
        }
        if (op.availableFrom && !op.availableTo && date < op.availableFrom) {
          updates.availableFrom = date;
        }
        if (!op.availableFrom && !op.availableTo) {
          updates.availableFrom = date;
          updates.availableTo = date;
        }
        if (Object.keys(updates).length > 0) {
          try {
            const res = await fetch(`/api/operators/${operatorId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
              credentials: "include",
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
              toast({ title: "Availability Updated", description: `Operator is now available on ${date}` });
            } else {
              toast({ title: "Error", description: "Failed to update availability", variant: "destructive" });
            }
          } catch {
            toast({ title: "Error", description: "Failed to update availability", variant: "destructive" });
          }
        }
      }
    }
  }, [timeOffRecords, operators, deleteTimeOff, removeTimeOffDay, toast, queryClient]);

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

  useEffect(() => {
    if (!mapVisible || !mapsReady || !mapRef.current) {
      return;
    }

    if (googleMap.current) return;

    googleMap.current = new google.maps.Map(mapRef.current, {
      center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
      zoom: 10,
      gestureHandling: "greedy",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    googleInfoWindow.current = new google.maps.InfoWindow();

    return () => {};
  }, [mapVisible, mapsReady]);

  useEffect(() => {
    if (!mapVisible && googleMap.current) {
      googleMarkers.current.forEach(m => m.setMap(null));
      googleMarkers.current = [];
      googleMap.current = null;
    }
  }, [mapVisible]);

  const mapFilteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((j: any) => j.scheduledDate === mapDate);
  }, [jobs, mapDate]);

  const mapJobsWithCoords = mapFilteredJobs.filter((j: any) => j.lat != null && j.lng != null).length;
  const mapTruckMarkers = operators?.filter((op: any) => op.truckLat != null && op.truckLng != null).length || 0;

  useEffect(() => {
    if (!googleMap.current) return;

    googleMarkers.current.forEach(m => m.setMap(null));
    googleMarkers.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    if (operators) {
      operators.forEach((op: any) => {
        let markerLat = op.truckLat;
        let markerLng = op.truckLng;
        let locationLabel = op.truckLocation || "Unknown";
        let locationNote = "Truck Parked At";

        if (op.isOutOfState && jobs) {
          const prevDayJob = jobs
            .filter((j: any) => j.operatorId === op.id && j.lat != null && j.lng != null && j.scheduledDate <= mapDate)
            .sort((a: any, b: any) => b.scheduledDate.localeCompare(a.scheduledDate))[0];

          if (prevDayJob) {
            markerLat = prevDayJob.lat;
            markerLng = prevDayJob.lng;
            locationLabel = prevDayJob.address || "Previous job site";
            locationNote = "Out-of-State — Near Previous Job";
          }
        }

        if (markerLat != null && markerLng != null) {
          bounds.extend({ lat: markerLat, lng: markerLng });
          hasPoints = true;

          const marker = new google.maps.Marker({
            map: googleMap.current!,
            position: { lat: markerLat, lng: markerLng },
            title: op.name,
            icon: {
              url: createTruckMarkerSvg(getOperatorColor(op)),
              scaledSize: new google.maps.Size(28, 28),
            },
          });

          const outOfStateBadge = op.isOutOfState
            ? `<div style="font-size:10px;color:#f59e0b;font-weight:600;margin-top:4px;">OUT OF STATE</div>`
            : '';
          const infoContent = `
            <div style="min-width: 160px; font-family: system-ui, sans-serif;">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${escapeHtml(op.name)}</div>
              ${outOfStateBadge}
              <div style="font-size: 11px; color: #888;">${escapeHtml(locationNote)}</div>
              <div style="font-size: 12px; margin-top: 2px;">${escapeHtml(locationLabel)}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">${escapeHtml(op.groupName)}</div>
            </div>
          `;

          marker.addListener("click", () => {
            googleInfoWindow.current?.setContent(infoContent);
            googleInfoWindow.current?.open(googleMap.current!, marker);
          });

          googleMarkers.current.push(marker);
        }
      });
    }

    mapFilteredJobs.forEach((job: any) => {
      if (job.lat == null || job.lng == null) return;
      const lat = job.lat!;
      const lng = job.lng!;
      bounds.extend({ lat, lng });
      hasPoints = true;

      const markerColor = STATUS_COLORS[job.status]?.hex || "#9ca3af";

      const marker = new google.maps.Marker({
        map: googleMap.current!,
        position: { lat, lng },
        title: job.customer?.name || "Job",
        icon: {
          url: createJobMarkerSvg(markerColor),
          scaledSize: new google.maps.Size(24, 24),
        },
      });

      const operatorName = escapeHtml(job.operator?.name || "Unassigned");
      const customerName = escapeHtml(job.customer?.name || "Unknown");
      const statusLabel = STATUS_COLORS[job.status]?.label || job.status;
      const assignedOp = operators?.find((o: any) => o.id === job.operatorId);
      const hasTruckLoc = assignedOp && assignedOp.truckLat != null && assignedOp.truckLng != null;
      const travelTimeId = `travel-time-${job.id}`;
      const travelBtnId = `travel-btn-${job.id}`;

      const infoContent = `
        <div style="min-width: 180px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${customerName}</div>
          <div style="font-size: 11px; color: #666;">${escapeHtml(job.scope || "")}</div>
          <hr style="margin: 4px 0; border-color: #eee;" />
          <div style="font-size: 11px;"><strong>Operator:</strong> ${operatorName}</div>
          <div style="font-size: 11px;"><strong>Date:</strong> ${escapeHtml(job.scheduledDate)}</div>
          <div style="font-size: 11px;"><strong>Time:</strong> ${escapeHtml(job.startTime || "")}</div>
          <div style="font-size: 11px;"><strong>Status:</strong> 
            <span style="display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 10px; background: ${markerColor}20; color: ${markerColor}; font-weight: 600;">${escapeHtml(statusLabel)}</span>
          </div>
          <div style="font-size: 11px; margin-top: 3px; color: #888;">${escapeHtml(job.address || "")}</div>
          ${hasTruckLoc ? `
            <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #eee;">
              <div id="${travelTimeId}" style="font-size: 11px; color: #666;"></div>
              <button id="${travelBtnId}" style="font-size: 11px; color: #2563eb; cursor: pointer; background: none; border: none; padding: 2px 0; text-decoration: underline;">
                Calculate drive time from truck
              </button>
            </div>
          ` : ''}
        </div>
      `;

      marker.addListener("click", () => {
        googleInfoWindow.current?.setContent(infoContent);
        googleInfoWindow.current?.open(googleMap.current!, marker);

        if (hasTruckLoc) {
          setTimeout(() => {
            const btn = document.getElementById(travelBtnId);
            const display = document.getElementById(travelTimeId);
            if (btn && display) {
              btn.addEventListener("click", async () => {
                btn.textContent = "Calculating...";
                btn.style.color = "#888";
                try {
                  const resp = await fetch(`/api/travel-time?originLat=${assignedOp!.truckLat}&originLng=${assignedOp!.truckLng}&destLat=${lat}&destLng=${lng}`);
                  const result = await resp.json();
                  if (result.duration) {
                    display.innerHTML = `<strong style="color:#16a34a;">${result.duration}</strong> &middot; ${result.distance}`;
                    btn.style.display = "none";
                  } else {
                    display.textContent = "Unable to calculate route";
                    btn.style.display = "none";
                  }
                } catch {
                  display.textContent = "Error calculating route";
                  btn.style.display = "none";
                }
              });
            }
          }, 100);
        }
      });

      googleMarkers.current.push(marker);
    });

    if (hasPoints) {
      googleMap.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      const listener = googleMap.current.addListener("idle", () => {
        const zoom = googleMap.current?.getZoom();
        if (zoom && zoom > 13) googleMap.current?.setZoom(13);
        google.maps.event.removeListener(listener);
      });
    }
  }, [mapFilteredJobs, operators, mapDate, mapsReady]);

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

  const operatorOffDays = new Set<string>();
  timeOffRecords?.forEach((record) => {
    const start = new Date(record.startDate);
    const end = new Date(record.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      operatorOffDays.add(`${record.operatorId}-${format(d, "yyyy-MM-dd")}`);
    }
  });

  operators?.forEach((op) => {
    if (op.isOutOfState && (op.availableFrom || op.availableTo)) {
      weekDays.forEach((day) => {
        const dayStr = day.iso;
        if (op.availableFrom && dayStr < op.availableFrom) {
          operatorOffDays.add(`${op.id}-${dayStr}`);
        }
        if (op.availableTo && dayStr > op.availableTo) {
          operatorOffDays.add(`${op.id}-${dayStr}`);
        }
      });
    }
  });

  const jobsWithCoords = mapJobsWithCoords;
  const truckMarkers = mapTruckMarkers;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-muted/30">
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
          <span className="text-sm font-medium text-muted-foreground ml-2">
            {format(startDate, "MMMM yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-3">
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
          <Button onClick={() => { setSelectedJob(null); setDefaultDate(undefined); setDefaultOperatorId(null); setIsCreateOpen(true); }} className="shadow-lg shadow-primary/20" data-testid="button-new-job">
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

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
            <div className="flex border-b bg-muted/50">
              <div className="w-48 shrink-0 p-4 font-semibold text-sm border-r bg-muted/50 sticky left-0 z-10 flex items-center">
                Operators
              </div>
              {weekDays.map((day) => (
                <div 
                  key={day.iso} 
                  className={cn(
                    "flex-1 min-w-[140px] p-3 text-center border-r last:border-r-0",
                    day.iso === format(new Date(), "yyyy-MM-dd") && "bg-primary/5"
                  )}
                >
                  <div className="font-semibold text-sm">{day.label}</div>
                </div>
              ))}
            </div>

            <ScrollArea className="flex-1 custom-scrollbar">
              <div className="min-w-fit">
                {(() => {
                  let lastGroup = "";
                  let rowIndex = 0;
                  return operators?.map((operator) => {
                    const showGroupHeader = operator.groupName !== lastGroup;
                    if (showGroupHeader) rowIndex = 0;
                    const currentGroup = operator.groupName;
                    lastGroup = currentGroup;
                    const isCollapsed = collapsedGroups.has(currentGroup);
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
                                <div className="font-bold text-sm leading-tight truncate">{operator.name}</div>
                                {operator.phone && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{operator.phone}</div>
                                )}
                                {operator.isOutOfState && (
                                  <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                                    OOS — {operator.groupName}
                                  </div>
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
                            onCellClick={(date, opId) => { setSelectedJob(null); setDefaultDate(date); setDefaultOperatorId(opId); setIsCreateOpen(true); }}
                            onPlaceHold={handlePlaceHold}
                            onAddNote={handleAddNote}
                            onRemoveOff={handleRemoveOff}
                            isEvenRow={isEven}
                            isOff={isOff}
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
                        <div data-testid={`standby-cell-${day.iso}`}>
                          {standbyExpanded && dayStandby.map((job) => (
                            <div key={job.id} onClick={() => setViewingJob(job)}>
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
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Map</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setMapDate(format(addDays(parseISO(mapDate), -1), "yyyy-MM-dd"))}
                      data-testid="button-map-prev-day"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs font-medium min-w-[80px] text-center" data-testid="text-map-date">
                      {format(parseISO(mapDate), "EEE M/d")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setMapDate(format(addDays(parseISO(mapDate), 1), "yyyy-MM-dd"))}
                      data-testid="button-map-next-day"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {jobsWithCoords} job{jobsWithCoords !== 1 ? "s" : ""}
                    </span>
                    {truckMarkers > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {truckMarkers}
                      </span>
                    )}
                  </div>
                </div>
                <div ref={mapRef} className="flex-1" data-testid="map-container" />
                <div className="px-3 py-1.5 border-t bg-muted/20 flex flex-wrap gap-x-3 gap-y-1 shrink-0">
                  {Object.entries(STATUS_COLORS).map(([key, val]) => {
                    const count = mapFilteredJobs.filter((j: any) => j.status === key && j.lat != null).length || 0;
                    if (count === 0) return null;
                    return (
                      <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <div className="w-2 h-2 rounded-full" style={{ background: val.hex }} />
                        <span>{val.label} ({count})</span>
                      </div>
                    );
                  })}
                </div>
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

      <AvailabilityChart weekDays={weekDays} jobs={jobs} operators={operators} operatorOffDays={operatorOffDays} />

      <CreateJobDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen}
        initialData={selectedJob}
        defaultDate={defaultDate}
        defaultOperatorId={defaultOperatorId}
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
            setNoteDialog({ open: true, date: job.scheduledDate, operatorId: job.operatorId || 0, editJob: job });
          } else {
            setSelectedJob(job); setDefaultDate(undefined); setDefaultOperatorId(null); setIsCreateOpen(true);
          }
        }}
      />

      <DispatchNoteDialog
        open={noteDialog.open}
        onOpenChange={(open) => setNoteDialog(prev => ({ ...prev, open }))}
        date={noteDialog.date}
        operatorId={noteDialog.operatorId}
        editJob={noteDialog.editJob}
      />
    </div>
  );
}
