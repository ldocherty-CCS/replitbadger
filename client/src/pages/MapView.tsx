import { useState, useEffect, useRef, useMemo } from "react";
import { useJobs } from "@/hooks/use-jobs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MapPin, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { format, addDays, startOfWeek, parseISO, addWeeks } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useGoogleMapsReady } from "@/components/AddressAutocomplete";

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

const STATUS_COLORS: Record<string, { label: string; hex: string }> = {
  dispatched: { label: "Dispatched", hex: "#22c55e" },
  ready: { label: "Ready", hex: "#1e40af" },
  ticket_created: { label: "Ticket Created", hex: "#38bdf8" },
  existing: { label: "Existing", hex: "#9ca3af" },
  missing_info: { label: "Missing Info", hex: "#f472b6" },
  not_qualified: { label: "Not Qualified", hex: "#fb923c" },
  cancelled: { label: "Cancelled", hex: "#6b7280" },
  standby: { label: "Standby", hex: "#a855f7" },
  unavailable: { label: "Unavailable", hex: "#ef4444" },
};

const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_COLORS: Record<number, string> = {
  0: "#3b82f6",
  1: "#10b981",
  2: "#f59e0b",
  3: "#8b5cf6",
  4: "#ef4444",
  5: "#06b6d4",
  6: "#ec4899",
};

const DEFAULT_CENTER: [number, number] = [43.0389, -87.9065];

function createJobMarkerSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
    <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="3"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createDayBadgeMarkerSvg(statusColor: string, dayAbbrev: string, dayColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42">
    <circle cx="16" cy="22" r="14" fill="${statusColor}" stroke="white" stroke-width="3"/>
    <rect x="20" y="2" width="${dayAbbrev.length > 2 ? 22 : 20}" height="16" rx="6" fill="${dayColor}" stroke="white" stroke-width="1"/>
    <text x="${20 + (dayAbbrev.length > 2 ? 11 : 10)}" y="14" text-anchor="middle" fill="white" font-size="9" font-weight="700" font-family="system-ui, sans-serif">${dayAbbrev}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function MapView() {
  const monday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const friday = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 4), "yyyy-MM-dd");

  const [rangeStart, setRangeStart] = useState(monday);
  const [rangeEnd, setRangeEnd] = useState(friday);
  const [hideDispatched, setHideDispatched] = useState(true);
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const [isBackfilling, setIsBackfilling] = useState(false);
  const { toast } = useToast();

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMap = useRef<google.maps.Map | null>(null);
  const googleMarkers = useRef<google.maps.Marker[]>([]);
  const googleInfoWindow = useRef<google.maps.InfoWindow | null>(null);
  const mapsReady = useGoogleMapsReady();

  const queryFilters = useMemo(() => {
    return { startDate: rangeStart, endDate: rangeEnd };
  }, [rangeStart, rangeEnd]);

  const { data: jobs, isLoading: jobsLoading, refetch } = useJobs(queryFilters);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    let result = jobs as any[];
    if (hideDispatched) {
      result = result.filter((j) => j.status !== "dispatched");
    }
    if (seriesFilter && seriesFilter !== "all") {
      result = result.filter((j) => j.seriesId === seriesFilter);
    }
    return result;
  }, [jobs, hideDispatched, seriesFilter]);

  const seriesOptions = useMemo(() => {
    if (!jobs) return [];
    const seriesMap = new Map<string, { id: string; label: string; count: number }>();
    (jobs as any[]).forEach((j) => {
      if (j.seriesId) {
        if (!seriesMap.has(j.seriesId)) {
          const customerName = j.customer?.name || "Unknown";
          seriesMap.set(j.seriesId, {
            id: j.seriesId,
            label: `${customerName} - ${j.scope?.substring(0, 30) || "No scope"}`,
            count: 0,
          });
        }
        seriesMap.get(j.seriesId)!.count++;
      }
    });
    return Array.from(seriesMap.values());
  }, [jobs]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    if (googleMap.current) {
      const mapDiv = googleMap.current.getDiv();
      if (mapDiv && mapDiv.parentElement) return;
    }
    googleMap.current = new google.maps.Map(mapRef.current, {
      center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
      zoom: 10,
      gestureHandling: "greedy",
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    googleInfoWindow.current = new google.maps.InfoWindow();
    return () => {
      googleMarkers.current.forEach((m) => m.setMap(null));
      googleMarkers.current = [];
      googleMap.current = null;
    };
  }, [mapsReady]);

  const isMultiDay = rangeStart !== rangeEnd;

  useEffect(() => {
    if (!googleMap.current) return;

    googleMarkers.current.forEach((m) => m.setMap(null));
    googleMarkers.current = [];

    const jobsWithLocation = filteredJobs.filter(
      (j: any) => j.lat != null && j.lng != null
    );

    if (jobsWithLocation.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    jobsWithLocation.forEach((job: any) => {
      const lat = job.lat!;
      const lng = job.lng!;
      bounds.extend({ lat, lng });
      hasPoints = true;

      const statusColor = STATUS_COLORS[job.status]?.hex || "#9ca3af";
      const jobDate = parseISO(job.scheduledDate);
      const dayOfWeek = jobDate.getDay();
      const dayAbbrev = DAY_ABBREVS[dayOfWeek];
      const dayColor = DAY_COLORS[dayOfWeek] || "#9ca3af";

      const iconUrl = isMultiDay
        ? createDayBadgeMarkerSvg(statusColor, dayAbbrev, dayColor)
        : createJobMarkerSvg(statusColor);

      const iconSize = isMultiDay
        ? new google.maps.Size(42, 42)
        : new google.maps.Size(28, 28);

      const anchor = isMultiDay
        ? new google.maps.Point(16, 22)
        : new google.maps.Point(14, 14);

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: googleMap.current!,
        icon: {
          url: iconUrl,
          scaledSize: iconSize,
          anchor: anchor,
        },
      });

      const operatorName = escapeHtml(job.operator?.name || "Unassigned");
      const customerName = escapeHtml(job.customer?.name || "Unknown");
      const scopeText = escapeHtml(job.scope || "");
      const addressText = escapeHtml(job.address || "");
      const startTimeText = escapeHtml(job.startTime || "");
      const statusLabel = STATUS_COLORS[job.status]?.label || job.status;
      const dateLabel = format(jobDate, "EEE, MMM d");
      const seriesLabel = job.seriesId ? `<div style="font-size: 11px; color: #888; margin-top: 4px;">Series job</div>` : "";

      const contentString = `
        <div style="min-width: 220px; font-family: system-ui, sans-serif;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="
              display: inline-block; width: 10px; height: 10px; border-radius: 50%;
              background: ${dayColor}; flex-shrink: 0;
            "></span>
            <span style="font-weight: 600; font-size: 13px; color: ${dayColor};">${dateLabel}</span>
          </div>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${customerName}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${scopeText}</div>
          <hr style="margin: 6px 0; border-color: #eee;" />
          <div style="font-size: 12px;"><strong>Operator:</strong> ${operatorName}</div>
          <div style="font-size: 12px;"><strong>Time:</strong> ${startTimeText}</div>
          <div style="font-size: 12px;"><strong>Status:</strong> 
            <span style="
              display: inline-block; padding: 1px 8px; border-radius: 9999px; 
              font-size: 11px; background: ${statusColor}20; color: ${statusColor}; font-weight: 600;
            ">${escapeHtml(statusLabel)}</span>
          </div>
          <div style="font-size: 12px; margin-top: 4px; color: #888;">${addressText}</div>
          ${seriesLabel}
        </div>
      `;

      marker.addListener("click", () => {
        googleInfoWindow.current?.setContent(contentString);
        googleInfoWindow.current?.open(googleMap.current!, marker);
      });

      googleMarkers.current.push(marker);
    });

    if (hasPoints) {
      googleMap.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [filteredJobs, isMultiDay, mapsReady]);

  const navigateWeek = (direction: number) => {
    const start = parseISO(rangeStart);
    const newStart = addWeeks(start, direction);
    setRangeStart(format(newStart, "yyyy-MM-dd"));
    setRangeEnd(format(addDays(newStart, 4), "yyyy-MM-dd"));
  };

  const handleBackfill = async () => {
    setIsBackfilling(true);
    try {
      const res = await apiRequest("POST", "/api/jobs/geocode-backfill");
      const data = await res.json();
      toast({
        title: "Geocoding Complete",
        description: `Geocoded ${data.geocoded} of ${data.total} jobs missing coordinates`,
      });
      refetch();
    } catch {
      toast({ title: "Error", description: "Failed to geocode jobs", variant: "destructive" });
    } finally {
      setIsBackfilling(false);
    }
  };

  const totalJobs = filteredJobs.length;
  const jobsWithCoords = filteredJobs.filter((j: any) => j.lat != null && j.lng != null).length;
  const jobsWithoutCoords = totalJobs - jobsWithCoords;

  const dayBreakdown = useMemo(() => {
    const counts: Record<number, number> = {};
    filteredJobs.forEach((j: any) => {
      if (j.lat != null && j.lng != null) {
        const day = parseISO(j.scheduledDate).getDay();
        counts[day] = (counts[day] || 0) + 1;
      }
    });
    return counts;
  }, [filteredJobs]);

  return (
    <div className="h-[calc(100vh-65px)] flex flex-col">
      <div className="border-b bg-card p-3">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold" data-testid="text-map-title">Job Map</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)} data-testid="button-prev-week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="w-40"
              data-testid="input-range-start"
            />
            <Label className="text-sm text-muted-foreground">to</Label>
            <Input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="w-40"
              data-testid="input-range-end"
            />
            <Button variant="outline" size="icon" onClick={() => navigateWeek(1)} data-testid="button-next-week">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRangeStart(monday);
                setRangeEnd(friday);
              }}
              data-testid="button-this-week"
            >
              This Week
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="hide-dispatched"
              checked={hideDispatched}
              onCheckedChange={(v) => setHideDispatched(!!v)}
              data-testid="checkbox-hide-dispatched"
            />
            <Label htmlFor="hide-dispatched" className="text-sm cursor-pointer">
              Hide Dispatched
            </Label>
          </div>

          {seriesOptions.length > 0 && (
            <Select value={seriesFilter} onValueChange={setSeriesFilter}>
              <SelectTrigger className="w-56" data-testid="select-series-filter">
                <SelectValue placeholder="Filter by series" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {seriesOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {jobsWithoutCoords > 0 && (
            <Button
              variant="outline"
              onClick={handleBackfill}
              disabled={isBackfilling}
              data-testid="button-geocode-backfill"
            >
              {isBackfilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Geocode {jobsWithoutCoords} job{jobsWithoutCoords !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        {jobsLoading && (
          <div className="absolute inset-0 z-[1000] bg-background/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <div ref={mapRef} className="h-full w-full" data-testid="map-container" />

        <div className="absolute bottom-4 left-4 z-[1000]">
          <Card className="w-72">
            <CardContent className="p-3">
              <div className="text-sm font-medium mb-2" data-testid="text-job-summary">
                {jobsWithCoords} of {totalJobs} job{totalJobs !== 1 ? "s" : ""} on map
                {hideDispatched && (
                  <span className="text-muted-foreground ml-1">(dispatched hidden)</span>
                )}
              </div>

              {isMultiDay && (
                <>
                  <div className="text-xs text-muted-foreground mb-1.5 font-medium">Jobs by day:</div>
                  <div className="space-y-0.5 mb-2">
                    {Object.entries(dayBreakdown)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([dayNum, count]) => (
                        <div key={dayNum} className="flex items-center gap-2 text-xs">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: DAY_COLORS[Number(dayNum)] }}
                          />
                          <span className="text-muted-foreground">{DAY_ABBREVS[Number(dayNum)]}</span>
                          <span className="ml-auto font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}

              <div className="text-xs text-muted-foreground mb-1.5 font-medium">Status legend:</div>
              <div className="space-y-0.5">
                {Object.entries(STATUS_COLORS).map(([key, val]) => {
                  const count = filteredJobs.filter((j: any) => j.status === key && j.lat != null && j.lng != null).length;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: val.hex }} />
                      <span className="text-muted-foreground">{val.label}</span>
                      <span className="ml-auto font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
