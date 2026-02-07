import { useState, useMemo } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJobs } from "@/hooks/use-jobs";
import { useOperators } from "@/hooks/use-operators";
import { useTimeOff } from "@/hooks/use-time-off";
import { cn } from "@/lib/utils";
import type { Job, Operator } from "@shared/schema";

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

export function MobileCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());

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
      if (op.isOutOfState && (op.availableFrom || op.availableTo)) {
        weekDays.forEach((day) => {
          if (op.availableFrom && day.iso < op.availableFrom) {
            offDays.add(`${op.id}-${day.iso}`);
          }
          if (op.availableTo && day.iso > op.availableTo) {
            offDays.add(`${op.id}-${day.iso}`);
          }
        });
      }
    });
    return offDays;
  }, [timeOffRecords, operators, weekDays]);

  const jobsMap = useMemo(() => {
    const map: Record<string, Job[]> = {};
    jobs?.forEach((job) => {
      if (job.status === "cancelled" || job.status === "standby") return;
      if (!job.operatorId) return;
      const key = `${job.operatorId}-${job.scheduledDate}`;
      if (!map[key]) map[key] = [];
      map[key].push(job);
    });
    return map;
  }, [jobs]);

  const dayStats = useMemo(() => {
    const totalTrucks = operators?.length || 0;
    return weekDays.map((day) => {
      const dayJobs = jobs?.filter(
        (j) =>
          j.scheduledDate === day.iso &&
          j.status !== "cancelled" &&
          j.status !== "standby"
      ) || [];
      const uniqueOps = new Set(dayJobs.map((j) => j.operatorId).filter(Boolean));
      const booked = uniqueOps.size;
      const offCount =
        operators?.filter((op) => operatorOffDays.has(`${op.id}-${day.iso}`))
          .length || 0;
      const effective = totalTrucks - offCount;
      const available = Math.max(0, effective - booked);
      const overbooked = booked > effective;
      const overbookedCount = booked - effective;
      return { ...day, booked, available, overbooked, overbookedCount, effective, offCount };
    });
  }, [weekDays, jobs, operators, operatorOffDays]);

  const todayIso = format(new Date(), "yyyy-MM-dd");

  if (jobsLoading || opsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const sortedOperators = operators?.slice().sort((a, b) => {
    if (a.groupName !== b.groupName) return (a.groupName || "").localeCompare(b.groupName || "");
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background" data-testid="mobile-calendar-view">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={prevWeek} data-testid="mobile-prev-week">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={goToday}
          className="text-sm font-semibold"
          data-testid="mobile-today"
        >
          {format(startDate, "MMM yyyy")}
        </Button>
        <Button variant="ghost" size="icon" onClick={nextWeek} data-testid="mobile-next-week">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 border-b bg-muted/50 shrink-0" data-testid="mobile-day-headers">
        {dayStats.map((day) => (
          <div
            key={day.iso}
            className={cn(
              "flex flex-col items-center py-1.5",
              day.iso === todayIso && "relative"
            )}
          >
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              {day.dayLetter}
            </span>
            <span
              className={cn(
                "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
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
            <div key={day.iso} className="flex flex-col items-center px-0.5 py-1.5">
              <div className="relative w-full h-6 flex items-end justify-center">
                <div
                  className="w-full max-w-[28px] rounded-sm transition-all duration-300"
                  style={{
                    height: `${day.overbooked ? 100 : Math.max(12, ratio * 100)}%`,
                    background: barColor,
                    opacity: 0.85,
                  }}
                />
              </div>
              <span
                className={cn(
                  "text-[9px] font-bold mt-0.5 leading-tight",
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
          {sortedOperators?.map((operator) => {
            return (
              <div
                key={operator.id}
                className="grid border-b last:border-b-0"
                style={{ gridTemplateColumns: "minmax(64px, auto) repeat(7, 1fr)" }}
                data-testid={`mobile-row-${operator.id}`}
              >
                <div className="px-1.5 py-1 flex items-center border-r bg-muted/30 sticky left-0 z-10">
                  <span className="text-[11px] font-semibold leading-tight truncate">
                    {operator.name.split(" ").map(n => n.slice(0, 6)).join(" ")}
                  </span>
                </div>
                {weekDays.map((day) => {
                  const key = `${operator.id}-${day.iso}`;
                  const cellJobs = jobsMap[key] || [];
                  const isOff = operatorOffDays.has(key);

                  return (
                    <div
                      key={day.iso}
                      className={cn(
                        "min-h-[36px] border-r last:border-r-0 p-0.5 flex flex-col gap-0.5",
                        isOff && "bg-red-100/60 dark:bg-red-950/30"
                      )}
                      data-testid={`mobile-cell-${operator.id}-${day.iso}`}
                    >
                      {isOff && cellJobs.length === 0 && (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-red-400 uppercase">OFF</span>
                        </div>
                      )}
                      {cellJobs.map((job) => {
                        const bg = STATUS_COLORS[job.status] || "#9ca3af";
                        const fg = getContrastText(bg);
                        const customerName = (job as any).customer?.name || "";
                        const truncName = customerName.length > 8
                          ? customerName.slice(0, 7)
                          : customerName;

                        return (
                          <div
                            key={job.id}
                            className="rounded-[3px] px-0.5 py-px leading-none overflow-hidden"
                            style={{ background: bg, color: fg }}
                            data-testid={`mobile-job-${job.id}`}
                          >
                            <span className="text-[9px] font-semibold block truncate">
                              {truncName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
