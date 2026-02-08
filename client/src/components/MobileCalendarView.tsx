import { useState, useMemo, useCallback } from "react";
import { format, addDays, startOfWeek, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, GripVertical, Plus, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJobs } from "@/hooks/use-jobs";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useOperators } from "@/hooks/use-operators";
import { useTimeOff } from "@/hooks/use-time-off";
import { useAllOperatorAvailability } from "@/hooks/use-operator-availability";
import { useToast } from "@/hooks/use-toast";
import { cn, formatOperatorShortName, formatOperatorFullName } from "@/lib/utils";
import type { Job, Operator } from "@shared/schema";
import { CreateJobDialog } from "./CreateJobDialog";
import { PlaceHoldDialog } from "./PlaceHoldDialog";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  TouchSensor,
  PointerSensor,
  pointerWithin,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";

const STATUS_COLORS: Record<string, string> = {
  dispatched: "#22c55e",
  unavailable: "#ef4444",
  ready: "#1e40af",
  ticket_created: "#38bdf8",
  existing: "#9ca3af",
  missing_info: "#f472b6",
  not_qualified: "#fb923c",
  cancelled: "#8b8b8b",
  standby: "#8b5cf6",
};

function getContrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000" : "#fff";
}

function MobileDraggableJob({ job, isAssistantEntry }: { job: Job & { customer?: { name: string } }; isAssistantEntry?: boolean }) {
  const draggableId = isAssistantEntry ? `mobile-job-${job.id}-assist` : `mobile-job-${job.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId,
    disabled: isAssistantEntry,
    data: { job },
  });

  const bg = STATUS_COLORS[job.status] || "#9ca3af";
  const fg = getContrastText(bg);
  const customerName = job.customer?.name || "";
  const truncName = customerName.length > 8 ? customerName.slice(0, 7) : customerName;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-[2px] px-1 py-0.5 leading-none overflow-hidden flex items-center touch-none w-full",
        isDragging && "opacity-40",
        isAssistantEntry && "opacity-75"
      )}
      style={{
        background: bg,
        color: fg,
        ...(isAssistantEntry ? { border: `1px dashed ${fg}` } : {}),
      }}
      data-testid={`mobile-job-${job.id}${isAssistantEntry ? '-assist' : ''}`}
    >
      <span className="text-[8px] font-bold block truncate w-full text-center">
        {isAssistantEntry ? `A: ${truncName}` : truncName}
      </span>
    </div>
  );
}

function MobileDropCell({
  operatorId,
  date,
  isOff,
  isEmpty,
  onTapEmpty,
  children,
}: {
  operatorId: number;
  date: string;
  isOff: boolean;
  isEmpty: boolean;
  onTapEmpty?: (operatorId: number, date: string) => void;
  children: React.ReactNode;
}) {
  const droppableId = `mobile-drop-${operatorId}-${date}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { operatorId, date, type: "schedule" },
  });

  const handleClick = () => {
    if (isEmpty && !isOff && onTapEmpty) {
      onTapEmpty(operatorId, date);
    }
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={cn(
        "min-h-[22px] border-r last:border-r-0 px-px py-px flex flex-col gap-px transition-colors",
        isOff && "bg-red-100/60 dark:bg-red-950/30",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/30",
        isEmpty && !isOff && "cursor-pointer"
      )}
      data-testid={`mobile-cell-${operatorId}-${date}`}
    >
      {children}
    </div>
  );
}

function DragOverlayContent({ job }: { job: Job & { customer?: { name: string } } }) {
  const bg = STATUS_COLORS[job.status] || "#9ca3af";
  const fg = getContrastText(bg);
  const customerName = job.customer?.name || "";

  return (
    <div
      className="rounded px-1.5 py-1 shadow-lg leading-none flex items-center gap-1 opacity-90"
      style={{ background: bg, color: fg, minWidth: 60 }}
    >
      <GripVertical className="w-3 h-3 shrink-0" />
      <span className="text-[10px] font-bold truncate">{customerName}</span>
    </div>
  );
}

export function MobileCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDragJob, setActiveDragJob] = useState<(Job & { customer?: { name: string } }) | null>(null);
  const [actionSheet, setActionSheet] = useState<{ operatorId: number; date: string } | null>(null);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ operatorId: number; date: string } | null>(null);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startDate, i);
    return {
      date: d,
      iso: format(d, "yyyy-MM-dd"),
      dayLetter: format(d, "EEEEE"),
      dayNum: format(d, "d"),
    };
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
  const { data: availabilityRecords } = useAllOperatorAvailability();

  const updateJob = useUpdateJob();
  const { toast } = useToast();

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  const collisionStrategy: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  }, []);

  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const goToday = () => setCurrentDate(new Date());

  const operatorOffDays = useMemo(() => {
    const offDays = new Set<string>();
    timeOffRecords?.forEach((record) => {
      const start = new Date(record.startDate + "T00:00:00");
      const end = new Date(record.endDate + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        offDays.add(`${record.operatorId}-${d.toISOString().split("T")[0]}`);
      }
    });
    operators?.forEach((op) => {
      if (op.isOutOfState) {
        const opAvailWindows = availabilityRecords?.filter((r) => r.operatorId === op.id) || [];
        if (opAvailWindows.length > 0) {
          weekDays.forEach((day) => {
            const isAvailable = opAvailWindows.some(
              (w) => day.iso >= w.startDate && day.iso <= w.endDate
            );
            if (!isAvailable) {
              offDays.add(`${op.id}-${day.iso}`);
            }
          });
        } else if (op.availableFrom || op.availableTo) {
          weekDays.forEach((day) => {
            if (op.availableFrom && day.iso < op.availableFrom) {
              offDays.add(`${op.id}-${day.iso}`);
            }
            if (op.availableTo && day.iso > op.availableTo) {
              offDays.add(`${op.id}-${day.iso}`);
            }
          });
        }
      }
    });
    return offDays;
  }, [timeOffRecords, operators, availabilityRecords, weekDays]);

  const { jobsMap, assistantJobIds } = useMemo(() => {
    const map: Record<string, Job[]> = {};
    const assistIds = new Set<number>();
    jobs?.forEach((job) => {
      if (job.status === "cancelled" || job.status === "standby") return;
      if (!job.operatorId) return;
      const key = `${job.operatorId}-${job.scheduledDate}`;
      if (!map[key]) map[key] = [];
      map[key].push(job);
      if ((job as any).assistantOperatorId) {
        const assistKey = `${(job as any).assistantOperatorId}-${job.scheduledDate}`;
        if (!map[assistKey]) map[assistKey] = [];
        map[assistKey].push(job);
        assistIds.add(job.id);
      }
    });
    return { jobsMap: map, assistantJobIds: assistIds };
  }, [jobs]);

  const dayStats = useMemo(() => {
    const truckOperators = operators?.filter(op => op.operatorType !== "assistant") || [];
    const totalTrucks = truckOperators.length;
    return weekDays.map((day) => {
      const dayJobs = jobs?.filter(
        (j) =>
          j.scheduledDate === day.iso &&
          j.status !== "cancelled" &&
          j.status !== "standby"
      ) || [];
      const truckOperatorIds = new Set(truckOperators.map(op => op.id));
      const uniqueOps = new Set(dayJobs.map((j) => j.operatorId).filter((id): id is number => id != null && truckOperatorIds.has(id)));
      const booked = uniqueOps.size;
      const offCount = truckOperators.filter(op => operatorOffDays.has(`${op.id}-${day.iso}`)).length;
      const effective = totalTrucks - offCount;
      const available = Math.max(0, effective - booked);
      const overbooked = booked > effective;
      const overbookedCount = booked - effective;
      return { ...day, booked, available, overbooked, overbookedCount, effective, offCount };
    });
  }, [weekDays, jobs, operators, operatorOffDays]);

  const todayIso = format(new Date(), "yyyy-MM-dd");

  const groupedOperators = useMemo(() => {
    if (!operators) return [];
    const sorted = operators.slice().sort((a, b) => {
      if (a.groupName !== b.groupName) return (a.groupName || "").localeCompare(b.groupName || "");
      const typeA = a.operatorType === "assistant" ? 1 : 0;
      const typeB = b.operatorType === "assistant" ? 1 : 0;
      if (typeA !== typeB) return typeA - typeB;
      const lastA = a.lastName.toLowerCase();
      const lastB = b.lastName.toLowerCase();
      if (lastA !== lastB) return lastA.localeCompare(lastB);
      return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase());
    });
    const groups: { name: string; operators: Operator[] }[] = [];
    let currentGroup = "";
    sorted.forEach((op) => {
      const g = op.groupName || "Other";
      if (g !== currentGroup) {
        currentGroup = g;
        groups.push({ name: g, operators: [] });
      }
      groups[groups.length - 1].operators.push(op);
    });
    return groups;
  }, [operators]);

  const handleTapEmpty = useCallback((operatorId: number, date: string) => {
    setSelectedCell({ operatorId, date });
    setActionSheet({ operatorId, date });
  }, []);

  const handleCreateJob = () => {
    setActionSheet(null);
    setCreateJobOpen(true);
  };

  const handleQuickHold = () => {
    setActionSheet(null);
    setHoldOpen(true);
  };

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

    if (operatorId && dateStr && operatorOffDays.has(`${operatorId}-${dateStr}`)) {
      const op = operators?.find((o: any) => o.id === operatorId);
      const opName = op ? formatOperatorFullName(op) : "This operator";
      toast({
        title: "Cannot Schedule",
        description: `${opName} has the day off on ${format(parseISO(dateStr), "EEE M/d")}. Remove their time off first.`,
        variant: "destructive",
      });
      return;
    }

    if (job.operatorId === operatorId && job.scheduledDate === dateStr) return;

    const targetKey = `${operatorId}-${dateStr}`;
    const existingJobs = jobsMap[targetKey] || [];
    const maxSort = existingJobs.reduce((max: number, j: Job) => Math.max(max, j.sortOrder ?? 0), 0);

    await updateJob.mutateAsync({
      id: job.id,
      operatorId,
      scheduledDate: dateStr,
      sortOrder: maxSort + 1,
    });
  };

  if (jobsLoading || opsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background" data-testid="mobile-calendar-view">
        <div className="flex items-center justify-between px-2 py-1 border-b bg-card shrink-0">
          <Button variant="ghost" size="icon" onClick={prevWeek} data-testid="mobile-prev-week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="text-xs font-semibold"
            data-testid="mobile-today"
          >
            {format(startDate, "MMM yyyy")}
          </Button>
          <Button variant="ghost" size="icon" onClick={nextWeek} data-testid="mobile-next-week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b bg-muted/50 shrink-0" data-testid="mobile-day-headers">
          {dayStats.map((day) => (
            <div
              key={day.iso}
              className={cn(
                "flex flex-col items-center py-0.5",
                day.iso === todayIso && "relative"
              )}
            >
              <span className="text-[9px] font-medium text-muted-foreground uppercase">
                {day.dayLetter}
              </span>
              <span
                className={cn(
                  "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                  day.iso === todayIso && "bg-primary text-primary-foreground"
                )}
              >
                {day.dayNum}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 border-b bg-card shrink-0" data-testid="mobile-capacity-chart">
          {dayStats.map((day) => {
            const ratio = day.effective > 0 ? day.available / day.effective : 0;
            const barColor = day.overbooked
              ? "hsl(0, 84%, 60%)"
              : day.available === 0
                ? "hsl(40, 96%, 50%)"
                : "hsl(142, 71%, 45%)";

            return (
              <div key={day.iso} className="flex flex-col items-center px-0.5 py-1">
                <div className="relative w-full h-4 flex items-end justify-center">
                  <div
                    className="w-full max-w-[24px] rounded-sm transition-all duration-300"
                    style={{
                      height: `${day.overbooked ? 100 : Math.max(12, ratio * 100)}%`,
                      background: barColor,
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[8px] font-bold mt-px leading-tight",
                    day.overbooked
                      ? "text-destructive"
                      : day.available === 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-foreground"
                  )}
                >
                  {day.overbooked ? `${day.overbookedCount}+` : `${day.available}/${day.effective}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto" data-testid="mobile-schedule-grid">
          <div className="min-w-0">
            {groupedOperators.map((group) => (
              <div key={group.name}>
                <div
                  className="sticky left-0 z-20 px-1.5 py-px bg-muted border-b border-t"
                  style={{ gridColumn: "1 / -1" }}
                  data-testid={`mobile-group-${group.name}`}
                >
                  <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                    {group.name}
                  </span>
                </div>
                {group.operators.map((operator, idx) => {
                  const isAssistant = operator.operatorType === "assistant";
                  const prevOp = idx > 0 ? group.operators[idx - 1] : null;
                  const showAssistantDivider = isAssistant && prevOp && prevOp.operatorType !== "assistant";
                  return (
                  <div key={operator.id}>
                    {showAssistantDivider && (
                      <div className="px-1.5 py-px bg-muted/50 border-b" data-testid={`mobile-assistant-divider-${group.name}`}>
                        <span className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground/70">Assistants</span>
                      </div>
                    )}
                  <div
                    className="grid border-b last:border-b-0"
                    style={{ gridTemplateColumns: "minmax(52px, 56px) repeat(7, 1fr)" }}
                    data-testid={`mobile-row-${operator.id}`}
                  >
                    <div className="px-1 py-px flex items-center border-r bg-muted/30 sticky left-0 z-10">
                      <span className="text-[9px] font-semibold leading-tight truncate">
                        {formatOperatorShortName(operator)}
                      </span>
                    </div>
                    {weekDays.map((day) => {
                      const key = `${operator.id}-${day.iso}`;
                      const cellJobs = jobsMap[key] || [];
                      const isOff = operatorOffDays.has(key);

                      return (
                        <MobileDropCell
                          key={day.iso}
                          operatorId={operator.id}
                          date={day.iso}
                          isOff={isOff}
                          isEmpty={cellJobs.length === 0}
                          onTapEmpty={handleTapEmpty}
                        >
                          {isOff && cellJobs.length === 0 && (
                            <div className="flex-1 flex items-center justify-center">
                              <span className="text-[7px] font-bold text-red-400 uppercase">OFF</span>
                            </div>
                          )}
                          {cellJobs.map((job) => {
                            const isAssist = assistantJobIds.has(job.id) && (job as any).assistantOperatorId === operator.id;
                            return (
                              <MobileDraggableJob key={`${job.id}${isAssist ? '-a' : ''}`} job={job as any} isAssistantEntry={isAssist} />
                            );
                          })}
                        </MobileDropCell>
                      );
                    })}
                  </div>
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragJob ? <DragOverlayContent job={activeDragJob as any} /> : null}
      </DragOverlay>

      {actionSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setActionSheet(null)}
          data-testid="mobile-action-sheet-backdrop"
        >
          <div
            className="w-full max-w-sm bg-card border-t rounded-t-xl shadow-lg p-4 pb-6 space-y-2 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
            data-testid="mobile-action-sheet"
          >
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <p className="text-xs text-muted-foreground text-center mb-3">
              {(() => { const op = operators?.find((o) => o.id === actionSheet.operatorId); return op ? formatOperatorFullName(op) : ""; })()} &mdash;{" "}
              {format(parseISO(actionSheet.date), "EEE, MMM d")}
            </p>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleCreateJob}
              data-testid="button-mobile-new-job"
            >
              <Plus className="w-4 h-4" />
              New Job
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleQuickHold}
              data-testid="button-mobile-quick-hold"
            >
              <PauseCircle className="w-4 h-4" />
              Quick Hold
            </Button>
          </div>
        </div>
      )}

      {selectedCell && (
        <>
          <CreateJobDialog
            open={createJobOpen}
            onOpenChange={(open) => {
              setCreateJobOpen(open);
              if (!open) setSelectedCell(null);
            }}
            defaultOperatorId={selectedCell.operatorId}
            defaultDate={selectedCell.date}
          />
          <PlaceHoldDialog
            open={holdOpen}
            onOpenChange={(open) => {
              setHoldOpen(open);
              if (!open) setSelectedCell(null);
            }}
            date={selectedCell.date}
            operatorId={selectedCell.operatorId}
          />
        </>
      )}
    </DndContext>
  );
}
