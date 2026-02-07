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
import { ChevronLeft, ChevronRight, Plus, Loader2, MapPin, Truck, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
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
  onCellClick,
}: { 
  date: string, 
  operatorId: number, 
  jobs: Job[], 
  onJobClick: (job: Job) => void,
  onDuplicate: (job: Job) => void,
  onDelete: (job: Job) => void,
  onStatusChange: (job: Job, status: string) => void,
  onCellClick: (date: string, operatorId: number) => void,
}) {
  return (
    <DroppableDay 
      id={`cell-${operatorId}-${date}`} 
      date={date} 
      operatorId={operatorId}
      className="min-h-[120px] p-2 border-r border-b bg-card/50 hover:bg-card transition-colors cursor-pointer"
    >
      <div 
        className="h-full min-h-[100px]" 
        onClick={() => onCellClick(date, operatorId)}
        data-testid={`cell-${operatorId}-${date}`}
      >
        {jobs.map((job) => (
          <div key={job.id} onClick={(e) => { e.stopPropagation(); onJobClick(job); }}>
            <JobCard
              job={job}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          </div>
        ))}
      </div>
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
    return { ...day, booked, available, overbooked, overbookedCount, totalJobs: dayJobs.length };
  });

  const maxJobs = Math.max(totalTrucks, ...dayStats.map((d) => d.totalJobs), 1);

  return (
    <div className="border-t bg-card px-4 py-3" data-testid="availability-chart">
      <div className="flex items-center gap-2 mb-2">
        <Truck className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Truck Availability</span>
        <span className="text-xs text-muted-foreground">({totalTrucks} total trucks)</span>
      </div>
      <div className="flex gap-2 items-end h-20">
        {dayStats.map((day) => {
          const barHeight = Math.max(8, (day.totalJobs / maxJobs) * 100);
          const capacityLine = (totalTrucks / maxJobs) * 100;

          return (
            <div key={day.iso} className="flex-1 flex flex-col items-center gap-1" data-testid={`availability-day-${day.iso}`}>
              <div className="relative w-full flex flex-col items-center" style={{ height: "64px" }}>
                <div
                  className="absolute bottom-0 w-full max-w-[48px] rounded-md transition-all duration-300"
                  style={{
                    height: `${barHeight}%`,
                    background: day.overbooked
                      ? "hsl(0, 84%, 60%)"
                      : day.available === 0
                        ? "hsl(40, 96%, 50%)"
                        : "hsl(var(--primary))",
                    opacity: day.overbooked ? 1 : 0.8,
                  }}
                  data-testid={`bar-${day.iso}`}
                />
                {totalTrucks > 0 && (
                  <div
                    className="absolute w-full border-t-2 border-dashed border-muted-foreground/40"
                    style={{ bottom: `${capacityLine}%` }}
                  />
                )}
              </div>
              <div className="text-center mt-1">
                <div className={cn(
                  "text-xs font-bold leading-tight",
                  day.overbooked ? "text-destructive" : day.available === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                )}>
                  {day.overbooked ? (
                    <span>{day.overbookedCount} over</span>
                  ) : (
                    <span>{day.available} free</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
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
          const icon = createTruckMarkerIcon(op.color || "#3b82f6");
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
  jobs?.forEach(job => {
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
                {operators?.map((operator) => (
                  <div key={operator.id} className="flex border-b last:border-b-0">
                    <div className="w-48 shrink-0 p-3 border-r bg-card sticky left-0 z-10 flex flex-col justify-center group hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-8 rounded-full shrink-0" 
                          style={{ backgroundColor: operator.color || '#3b82f6' }} 
                        />
                        <div>
                          <div className="font-bold text-sm leading-tight">{operator.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {operator.groupName}
                            {operator.isOutOfState && (
                              <span className="ml-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">OOS</span>
                            )}
                          </div>
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
                            onCellClick={(date, opId) => { setSelectedJob(null); setDefaultDate(date); setDefaultOperatorId(opId); setIsCreateOpen(true); }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
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
    </div>
  );
}
