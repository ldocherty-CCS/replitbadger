import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
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
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useJobs, useUpdateJob, useDeleteJob, useDuplicateJob } from "@/hooks/use-jobs";
import { useOperators } from "@/hooks/use-operators";
import { JobCard } from "@/components/JobCard";
import { CreateJobDialog } from "@/components/CreateJobDialog";
import { PlaceHoldDialog } from "@/components/PlaceHoldDialog";
import { ChevronLeft, ChevronRight, Plus, Loader2, MapPin, Truck, PanelRightClose, PanelRightOpen, Ban, ChevronDown, ChevronUp, Clock3, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOperatorColor } from "@/lib/operator-colors";
import type { Job, Customer, Operator } from "@shared/schema";
import { DroppableDay } from "@/components/DroppableDay";
import { useToast } from "@/hooks/use-toast";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function createJobMarkerIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 24px; height: 24px; 
      background: ${color}; 
      border: 3px solid white; 
      border-radius: 50%; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function createTruckMarkerIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 28px; height: 28px; 
      background: ${color}; 
      border: 3px solid white; 
      border-radius: 4px; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
    "><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function DayCell({ 
  date, 
  operatorId, 
  jobs, 
  onJobClick,
  onDuplicate,
  onDelete,
  onStatusChange,
  onCancel,
  onRestore,
  onCellClick,
  onPlaceHold,
  isEvenRow,
}: { 
  date: string, 
  operatorId: number, 
  jobs: Job[], 
  onJobClick: (job: Job) => void,
  onDuplicate: (job: Job) => void,
  onDelete: (job: Job) => void,
  onStatusChange: (job: Job, status: string) => void,
  onCancel: (job: Job) => void,
  onRestore: (job: Job) => void,
  onCellClick: (date: string, operatorId: number) => void,
  onPlaceHold: (date: string, operatorId: number) => void,
  isEvenRow?: boolean,
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = () => setCtxMenu(null);
    window.addEventListener("click", dismiss);
    window.addEventListener("contextmenu", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("click", dismiss);
      window.removeEventListener("contextmenu", dismiss);
      window.removeEventListener("scroll", dismiss, true);
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
        "min-h-[80px] p-1.5 border-r border-b hover:bg-accent/40 transition-colors cursor-pointer",
        isEvenRow ? "bg-muted/30" : "bg-card/50"
      )}
    >
      <div 
        className="h-full min-h-[60px]" 
        onClick={() => onCellClick(date, operatorId)}
        onContextMenu={handleContextMenu}
        data-testid={`cell-${operatorId}-${date}`}
      >
        {jobs.map((job) => (
          <div key={job.id} onClick={(e) => { e.stopPropagation(); onJobClick(job); }}>
            <JobCard
              job={job}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onCancel={onCancel}
              onRestore={onRestore}
            />
          </div>
        ))}
      </div>
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          data-testid={`cell-context-menu-${operatorId}-${date}`}
        >
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
        </div>
      )}
    </DroppableDay>
  );
}

function AvailabilityChart({
  weekDays,
  jobs,
  operators,
}: {
  weekDays: { date: Date; iso: string; label: string }[];
  jobs: Job[] | undefined;
  operators: Operator[] | undefined;
}) {
  const totalTrucks = operators?.length || 0;

  const dayStats = weekDays.map((day) => {
    const dayJobs = jobs?.filter((j) => j.scheduledDate === day.iso) || [];
    const uniqueOperatorsBooked = new Set(dayJobs.map((j) => j.operatorId).filter(Boolean));
    const booked = uniqueOperatorsBooked.size;
    const available = Math.max(0, totalTrucks - booked);
    const overbooked = dayJobs.length > totalTrucks;
    const overbookedCount = dayJobs.length - totalTrucks;
    return { ...day, booked, available, overbooked, overbookedCount };
  });

  return (
    <div className="border-t bg-card px-4 py-3" data-testid="availability-chart">
      <div className="flex gap-2 items-end h-16">
        {dayStats.map((day) => {
          const availableRatio = totalTrucks > 0 ? day.available / totalTrucks : 0;
          const barHeight = day.overbooked ? 100 : Math.max(6, availableRatio * 100);

          return (
            <div key={day.iso} className="flex-1 flex flex-col items-center gap-1" data-testid={`availability-day-${day.iso}`}>
              <div className="relative w-full flex flex-col items-center" style={{ height: "48px" }}>
                <div
                  className="absolute bottom-0 w-full max-w-[48px] rounded-md transition-all duration-300"
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
              <div className="text-center mt-0.5">
                <div className={cn(
                  "text-xs font-bold leading-tight",
                  day.overbooked ? "text-destructive" : day.available === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                )}>
                  {day.overbooked ? (
                    <span>{day.overbookedCount} over</span>
                  ) : (
                    <span>{day.available}/{totalTrucks}</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground leading-tight font-medium">
                  {format(day.date, "EEE")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
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
  const isDraggingSplit = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const duplicateJob = useDuplicateJob();
  const { toast } = useToast();

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

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

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

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

    const { operatorId, date: dateStr } = dropData;
    if (job.operatorId !== operatorId || job.scheduledDate !== dateStr) {
      await updateJob.mutateAsync({
        id: job.id,
        operatorId,
        scheduledDate: dateStr,
      });
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
    if (!mapVisible) {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        markersLayer.current = null;
      }
      return;
    }

    if (!mapRef.current) return;

    leafletMap.current = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 10,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletMap.current);

    markersLayer.current = L.layerGroup().addTo(leafletMap.current);

    setTimeout(() => {
      leafletMap.current?.invalidateSize();
    }, 200);
  }, [mapVisible]);

  useEffect(() => {
    if (leafletMap.current) {
      setTimeout(() => leafletMap.current?.invalidateSize(), 50);
    }
  }, [splitPercent]);

  useEffect(() => {
    if (!leafletMap.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();

    const bounds = L.latLngBounds([]);

    if (operators) {
      const todayIso = format(new Date(), "yyyy-MM-dd");
      const yesterdayIso = format(addDays(new Date(), -1), "yyyy-MM-dd");

      operators.forEach((op: any) => {
        let markerLat = op.truckLat;
        let markerLng = op.truckLng;
        let locationLabel = op.truckLocation || "Unknown";
        let locationNote = "Truck Parked At";

        if (op.isOutOfState && jobs) {
          const prevDayJob = jobs
            .filter((j: any) => j.operatorId === op.id && j.lat != null && j.lng != null && j.scheduledDate <= todayIso)
            .sort((a: any, b: any) => b.scheduledDate.localeCompare(a.scheduledDate))[0];

          if (prevDayJob) {
            markerLat = prevDayJob.lat;
            markerLng = prevDayJob.lng;
            locationLabel = prevDayJob.address || "Previous job site";
            locationNote = "Out-of-State \u2014 Near Previous Job";
          }
        }

        if (markerLat != null && markerLng != null) {
          bounds.extend([markerLat, markerLng]);
          const icon = createTruckMarkerIcon(getOperatorColor(op));
          const outOfStateBadge = op.isOutOfState
            ? '<div style="font-size:10px;color:#f59e0b;font-weight:600;margin-top:4px;">OUT OF STATE</div>'
            : '';
          const popup = L.popup().setContent(`
            <div style="min-width: 160px; font-family: system-ui, sans-serif;">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${escapeHtml(op.name)}</div>
              ${outOfStateBadge}
              <div style="font-size: 11px; color: #888;">${escapeHtml(locationNote)}</div>
              <div style="font-size: 12px; margin-top: 2px;">${escapeHtml(locationLabel)}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">${escapeHtml(op.groupName)}</div>
            </div>
          `);
          L.marker([markerLat, markerLng], { icon }).addTo(markersLayer.current!).bindPopup(popup);
        }
      });
    }

    if (jobs) {
      const jobsWithLocation = jobs.filter((j: any) => j.lat != null && j.lng != null);
      jobsWithLocation.forEach((job: any) => {
        const lat = job.lat!;
        const lng = job.lng!;
        bounds.extend([lat, lng]);

        const markerColor = STATUS_COLORS[job.status]?.hex || "#9ca3af";
        const icon = createJobMarkerIcon(markerColor);
        const operatorName = escapeHtml(job.operator?.name || "Unassigned");
        const customerName = escapeHtml(job.customer?.name || "Unknown");
        const statusLabel = STATUS_COLORS[job.status]?.label || job.status;

        const popup = L.popup().setContent(`
          <div style="min-width: 180px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${customerName}</div>
            <div style="font-size: 11px; color: #666;">${escapeHtml(job.scope || "")}</div>
            <hr style="margin: 4px 0; border-color: #eee;" />
            <div style="font-size: 11px;"><strong>Operator:</strong> ${operatorName}</div>
            <div style="font-size: 11px;"><strong>Date:</strong> ${escapeHtml(job.scheduledDate)}</div>
            <div style="font-size: 11px;"><strong>Time:</strong> ${escapeHtml(job.startTime || "")}</div>
            <div style="font-size: 11px;"><strong>Status:</strong> 
              <span style="
                display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 10px;
                background: ${markerColor}20; color: ${markerColor}; font-weight: 600;
              ">${escapeHtml(statusLabel)}</span>
            </div>
            <div style="font-size: 11px; margin-top: 3px; color: #888;">${escapeHtml(job.address || "")}</div>
          </div>
        `);

        L.marker([lat, lng], { icon }).addTo(markersLayer.current!).bindPopup(popup);
      });
    }

    if (bounds.isValid()) {
      leafletMap.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [jobs, operators]);

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
  });

  const jobsWithCoords = jobs?.filter((j: any) => j.lat != null && j.lng != null).length || 0;
  const truckMarkers = operators?.filter((op: any) => op.truckLat != null && op.truckLng != null).length || 0;

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
                    lastGroup = operator.groupName;
                    const isEven = rowIndex % 2 === 0;
                    rowIndex++;
                    return (
                      <div key={operator.id}>
                        {showGroupHeader && (
                          <div className="flex border-b bg-muted/40">
                            <div className="w-48 shrink-0 px-3 py-1.5 border-r sticky left-0 z-10 bg-muted/40">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{operator.groupName}</span>
                            </div>
                            {weekDays.map((day) => (
                              <div key={day.iso} className="flex-1 min-w-[140px] border-r last:border-r-0" />
                            ))}
                          </div>
                        )}
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
                      
                      return (
                        <div key={day.iso} className="flex-1 min-w-[140px]">
                          <DayCell 
                            date={day.iso} 
                            operatorId={operator.id} 
                            jobs={cellJobs}
                            onJobClick={(job) => { setSelectedJob(job); setDefaultDate(undefined); setDefaultOperatorId(null); setIsCreateOpen(true); }}
                            onDuplicate={handleDuplicate}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                            onCancel={handleCancel}
                            onRestore={handleRestore}
                            onCellClick={(date, opId) => { setSelectedJob(null); setDefaultDate(date); setDefaultOperatorId(opId); setIsCreateOpen(true); }}
                            onPlaceHold={handlePlaceHold}
                            isEvenRow={isEven}
                          />
                        </div>
                      );
                    })}
                        </div>
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
                      <div key={day.iso} className="flex-1 min-w-[140px] p-1.5 border-r last:border-r-0" data-testid={`standby-cell-${day.iso}`}>
                        {standbyExpanded && dayStandby.map((job) => (
                          <div key={job.id} onClick={() => { setSelectedJob(job); setDefaultDate(undefined); setDefaultOperatorId(null); setIsCreateOpen(true); }}>
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
                        {!standbyExpanded && dayStandby.length > 0 && (
                          <div className="text-center">
                            <Badge variant="secondary" className="text-[10px]">{dayStandby.length} standby</Badge>
                          </div>
                        )}
                      </div>
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
                      <div key={day.iso} className="flex-1 min-w-[140px] p-1.5 border-r last:border-r-0" data-testid={`cancelled-cell-${day.iso}`}>
                        <div className="text-center mb-1">
                          {dayCancelled.length > 0 && (
                            <Badge variant="secondary" className="text-[10px]" data-testid={`badge-cancelled-count-${day.iso}`}>
                              <Ban className="w-3 h-3 mr-1" />
                              {dayCancelled.length} truck{dayCancelled.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {cancelledExpanded && dayCancelled.map((job) => (
                          <div key={job.id} className="opacity-60" onClick={() => { setSelectedJob(job); setDefaultDate(undefined); setDefaultOperatorId(null); setIsCreateOpen(true); }}>
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
                    const count = jobs?.filter((j: any) => j.status === key && j.lat != null).length || 0;
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

      <AvailabilityChart weekDays={weekDays} jobs={jobs} operators={operators} />

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
    </div>
  );
}
