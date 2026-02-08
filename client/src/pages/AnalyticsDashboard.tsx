import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useJobs } from "@/hooks/use-jobs";
import { useTimeOff } from "@/hooks/use-time-off";
import { useOperators } from "@/hooks/use-operators";
import { formatOperatorFullName } from "@/lib/utils";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
  parseISO,
  differenceInDays,
  isWithinInterval,
  isBefore,
} from "date-fns";
import {
  Loader2,
  CalendarDays,
  ShieldAlert,
  MapPin,
  Clock,
  XCircle,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Operator, Qualification } from "@shared/schema";

function parseCity(address: string): string {
  if (!address) return "Unknown";
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[1].replace(/\s+\d{5}.*$/, "").trim();
  return address;
}

export default function AnalyticsDashboard() {
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: timeOffRecords, isLoading: timeOffLoading } = useTimeOff();
  const { data: operators, isLoading: operatorsLoading } = useOperators();

  const { data: oqRecords = [], isLoading: oqLoading } = useQuery<
    {
      id: number;
      operatorId: number;
      qualificationId: number;
      status: string;
      issueDate: string | null;
      expirationDate: string | null;
      documentUrl: string | null;
      documentName: string | null;
      notes: string | null;
    }[]
  >({
    queryKey: ["/api/operator-qualifications"],
  });

  const { data: qualifications = [] } = useQuery<Qualification[]>({
    queryKey: ["/api/qualifications"],
  });

  const isLoading = jobsLoading || timeOffLoading || operatorsLoading || oqLoading;

  const operatorMap = useMemo(() => {
    const map = new Map<number, Operator>();
    if (operators) {
      for (const op of operators) {
        map.set(op.id, op as Operator);
      }
    }
    return map;
  }, [operators]);

  const qualMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const q of qualifications) {
      map.set(q.id, q.name);
    }
    return map;
  }, [qualifications]);

  const weeklyTimeOff = useMemo(() => {
    if (!timeOffRecords) return [];
    const today = new Date();
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
      return { start: weekStart, end: weekEnd, count: 0, operatorIds: new Set<number>() };
    });

    for (const record of timeOffRecords) {
      const recStart = parseISO(record.startDate);
      const recEnd = parseISO(record.endDate);
      for (const week of weeks) {
        const overlaps =
          isWithinInterval(week.start, { start: recStart, end: recEnd }) ||
          isWithinInterval(week.end, { start: recStart, end: recEnd }) ||
          (isBefore(recStart, week.start) && isBefore(week.end, recEnd)) ||
          isWithinInterval(recStart, { start: week.start, end: week.end }) ||
          isWithinInterval(recEnd, { start: week.start, end: week.end });
        if (overlaps && record.operatorId) {
          week.operatorIds.add(record.operatorId);
        }
      }
    }
    return weeks.map(w => ({ start: w.start, end: w.end, count: w.operatorIds.size }));
  }, [timeOffRecords]);

  const expiringOQs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const results: {
      operatorName: string;
      qualificationName: string;
      daysUntil: number;
      severity: "red" | "amber" | "yellow";
    }[] = [];

    for (const oq of oqRecords) {
      if (!oq.expirationDate) continue;
      const expDate = parseISO(oq.expirationDate);
      const days = differenceInDays(expDate, today);
      if (days < 0 || days > 90) continue;
      const op = operatorMap.get(oq.operatorId);
      const operatorName = op ? formatOperatorFullName(op) : `Operator #${oq.operatorId}`;
      const qualificationName = qualMap.get(oq.qualificationId) || `Qual #${oq.qualificationId}`;
      let severity: "red" | "amber" | "yellow" = "yellow";
      if (days < 30) severity = "red";
      else if (days < 60) severity = "amber";
      results.push({ operatorName, qualificationName, daysUntil: days, severity });
    }

    results.sort((a, b) => a.daysUntil - b.daysUntil);
    return results;
  }, [oqRecords, operatorMap, qualMap]);

  const regionalDistribution = useMemo(() => {
    if (!jobs) return [];
    const regionMap = new Map<string, number>();
    for (const job of jobs) {
      if (job.status === "standby" || job.status === "cancelled") continue;
      const city = parseCity(job.address || "");
      regionMap.set(city, (regionMap.get(city) || 0) + 1);
    }
    return Array.from(regionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([region, count]) => ({ region, count }));
  }, [jobs]);

  const standbyData = useMemo(() => {
    if (!jobs) return { total: 0, byCustomer: [] as { name: string; count: number }[] };
    const standbyJobs = jobs.filter((j) => j.status === "standby");
    const customerMap = new Map<string, number>();
    for (const job of standbyJobs) {
      const name = job.customer?.name || "Unknown";
      customerMap.set(name, (customerMap.get(name) || 0) + 1);
    }
    const byCustomer = Array.from(customerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    return { total: standbyJobs.length, byCustomer };
  }, [jobs]);

  const cancelledData = useMemo(() => {
    if (!jobs) return { total: 0, recent: [] as any[] };
    const cancelled = jobs.filter((j) => j.status === "cancelled");
    const recent = cancelled
      .slice()
      .sort((a, b) => {
        const da = a.scheduledDate || "";
        const db = b.scheduledDate || "";
        return db.localeCompare(da);
      })
      .slice(0, 10);
    return { total: cancelled.length, recent };
  }, [jobs]);

  const topCustomers = useMemo(() => {
    if (!jobs) return [];
    const activeJobs = jobs.filter(
      (j) => j.status !== "cancelled" && j.status !== "standby"
    );
    const customerMap = new Map<string, number>();
    for (const job of activeJobs) {
      const name = job.customer?.name || "Unknown";
      customerMap.set(name, (customerMap.get(name) || 0) + 1);
    }
    const total = activeJobs.length;
    return Array.from(customerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] w-full flex items-center justify-center" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const maxWeeklyCount = Math.max(...weeklyTimeOff.map((w) => w.count), 1);
  const maxRegionalCount = Math.max(
    ...regionalDistribution.map((r) => r.count),
    1
  );
  const maxCustomerCount = Math.max(
    ...topCustomers.map((c) => c.count),
    1
  );

  return (
    <div className="px-6 py-6" data-testid="analytics-dashboard">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">
        Analytics
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card data-testid="card-time-off-by-week">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Time Off by Week</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Next 8 weeks
            </p>
            <div className="space-y-2">
              {weeklyTimeOff.map((week, i) => (
                <div key={i} className="flex items-center gap-3" data-testid={`row-time-off-week-${i}`}>
                  <span className="text-xs text-muted-foreground w-28 shrink-0">
                    {format(week.start, "MMM d")} - {format(week.end, "MMM d")}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-md transition-all"
                      style={{
                        width: `${(week.count / maxWeeklyCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-6 text-right" data-testid={`text-time-off-count-${i}`}>
                    {week.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-oq-alerts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">OQ Alerts</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Expiring qualifications (next 90 days)
            </p>
            {expiringOQs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expiring qualifications</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {expiringOQs.map((oq, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 py-1"
                    data-testid={`row-oq-alert-${i}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{oq.operatorName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {oq.qualificationName}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        oq.severity === "red"
                          ? "bg-red-500/10 text-red-600 border-red-200 shrink-0"
                          : oq.severity === "amber"
                            ? "bg-amber-500/10 text-amber-600 border-amber-200 shrink-0"
                            : "bg-yellow-500/10 text-yellow-600 border-yellow-200 shrink-0"
                      }
                      data-testid={`badge-oq-severity-${i}`}
                    >
                      {oq.daysUntil}d
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-regional-distribution">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Regional Work Distribution</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Top regions by job count
            </p>
            {regionalDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No job data available</p>
            ) : (
              <div className="space-y-2">
                {regionalDistribution.map((r, i) => (
                  <div key={i} className="flex items-center gap-3" data-testid={`row-region-${i}`}>
                    <span className="text-xs w-28 shrink-0 truncate" title={r.region}>
                      {r.region}
                    </span>
                    <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-md transition-all"
                        style={{
                          width: `${(r.count / maxRegionalCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-6 text-right" data-testid={`text-region-count-${i}`}>
                      {r.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-unserviced-demand">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Unserviced Demand</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Standby jobs - potential hiring gap
            </p>
            <div className="text-3xl font-bold mb-4" data-testid="text-standby-total">
              {standbyData.total}
            </div>
            {standbyData.byCustomer.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  By customer
                </p>
                {standbyData.byCustomer.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 text-sm"
                    data-testid={`row-standby-customer-${i}`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="font-medium shrink-0">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-cancelled-jobs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Cancelled Jobs</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Total cancelled
            </p>
            <div className="text-3xl font-bold mb-4" data-testid="text-cancelled-total">
              {cancelledData.total}
            </div>
            {cancelledData.recent && cancelledData.recent.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Recent
                </p>
                {cancelledData.recent.map((job: any, i: number) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between gap-2 text-sm"
                    data-testid={`row-cancelled-job-${job.id}`}
                  >
                    <span className="truncate">
                      {job.customer?.name || "Unknown"} - {job.scope}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {job.scheduledDate ? format(parseISO(job.scheduledDate), "MMM d") : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-top-customers">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Top Customers</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              By active job count
            </p>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No job data available</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center gap-3" data-testid={`row-top-customer-${i}`}>
                    <span className="text-xs font-medium w-5 shrink-0 text-muted-foreground">
                      {i + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm truncate">{c.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {c.count} ({c.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-md transition-all"
                          style={{
                            width: `${(c.count / maxCustomerCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
