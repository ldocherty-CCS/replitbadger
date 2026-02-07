import { useState, useEffect, useRef, useMemo } from "react";
import { useJobs } from "@/hooks/use-jobs";
import { useOperators } from "@/hooks/use-operators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPin, Calendar, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format, addDays, startOfWeek, parseISO, isWithinInterval } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Job, Operator } from "@shared/schema";

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

const STATUS_COLORS: Record<string, { bg: string; label: string; hex: string }> = {
  dispatched: { bg: "bg-green-500", label: "Dispatched", hex: "#22c55e" },
  off: { bg: "bg-red-500", label: "Off", hex: "#ef4444" },
  ready: { bg: "bg-blue-800", label: "Ready", hex: "#1e40af" },
  ticket_created: { bg: "bg-sky-400", label: "Ticket Created", hex: "#38bdf8" },
  existing: { bg: "bg-gray-400", label: "Existing", hex: "#9ca3af" },
  missing_info: { bg: "bg-pink-400", label: "Missing Info", hex: "#f472b6" },
  not_qualified: { bg: "bg-orange-400", label: "Not Qualified", hex: "#fb923c" },
};

const DAY_COLORS: Record<number, string> = {
  0: "#3b82f6",
  1: "#10b981",
  2: "#f59e0b",
  3: "#8b5cf6",
  4: "#ef4444",
  5: "#06b6d4",
  6: "#ec4899",
};

const DEFAULT_CENTER: [number, number] = [43.0389, -87.9065]; // Milwaukee, WI

function createMarkerIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 28px; height: 28px; 
      background: ${color}; 
      border: 3px solid white; 
      border-radius: 50%; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export default function MapView() {
  const [filterMode, setFilterMode] = useState<"day" | "range">("day");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rangeStart, setRangeStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [rangeEnd, setRangeEnd] = useState(format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6), "yyyy-MM-dd"));
  const [colorBy, setColorBy] = useState<"status" | "day">("status");

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  const queryFilters = useMemo(() => {
    if (filterMode === "day") {
      return { startDate: selectedDate, endDate: selectedDate };
    }
    return { startDate: rangeStart, endDate: rangeEnd };
  }, [filterMode, selectedDate, rangeStart, rangeEnd]);

  const { data: jobs, isLoading: jobsLoading } = useJobs(queryFilters);
  const { data: operators } = useOperators();

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

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

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!leafletMap.current || !markersLayer.current || !jobs) return;

    markersLayer.current.clearLayers();

    const jobsWithLocation = jobs.filter(
      (j: any) => j.lat != null && j.lng != null
    );

    if (jobsWithLocation.length === 0) return;

    const bounds = L.latLngBounds([]);

    jobsWithLocation.forEach((job: any) => {
      const lat = job.lat!;
      const lng = job.lng!;
      bounds.extend([lat, lng]);

      let markerColor = "#9ca3af";
      if (colorBy === "status") {
        markerColor = STATUS_COLORS[job.status]?.hex || "#9ca3af";
      } else {
        const jobDate = parseISO(job.scheduledDate);
        const dayOfWeek = jobDate.getDay();
        markerColor = DAY_COLORS[dayOfWeek] || "#9ca3af";
      }

      const icon = createMarkerIcon(markerColor);
      const operatorName = escapeHtml(job.operator?.name || "Unassigned");
      const customerName = escapeHtml(job.customer?.name || "Unknown");
      const scopeText = escapeHtml(job.scope || "");
      const addressText = escapeHtml(job.address || "");
      const startTimeText = escapeHtml(job.startTime || "");
      const statusLabel = STATUS_COLORS[job.status]?.label || job.status;

      const popup = L.popup().setContent(`
        <div style="min-width: 200px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${customerName}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${scopeText}</div>
          <hr style="margin: 6px 0; border-color: #eee;" />
          <div style="font-size: 12px;"><strong>Operator:</strong> ${operatorName}</div>
          <div style="font-size: 12px;"><strong>Date:</strong> ${format(parseISO(job.scheduledDate), "MMM d, yyyy")}</div>
          <div style="font-size: 12px;"><strong>Time:</strong> ${startTimeText}</div>
          <div style="font-size: 12px;"><strong>Status:</strong> 
            <span style="
              display: inline-block; 
              padding: 1px 8px; 
              border-radius: 9999px; 
              font-size: 11px; 
              background: ${markerColor}20; 
              color: ${markerColor};
              font-weight: 600;
            ">${escapeHtml(statusLabel)}</span>
          </div>
          <div style="font-size: 12px; margin-top: 4px; color: #888;">${addressText}</div>
        </div>
      `);

      L.marker([lat, lng], { icon }).addTo(markersLayer.current!).bindPopup(popup);
    });

    if (bounds.isValid()) {
      leafletMap.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [jobs, colorBy]);

  const navigateDay = (direction: number) => {
    const current = parseISO(selectedDate);
    const next = addDays(current, direction);
    setSelectedDate(format(next, "yyyy-MM-dd"));
  };

  const totalJobs = jobs?.length || 0;
  const jobsWithCoords = jobs?.filter((j: any) => j.lat != null && j.lng != null).length || 0;
  const jobsWithoutCoords = totalJobs - jobsWithCoords;

  return (
    <div className="h-[calc(100vh-65px)] flex flex-col">
      <div className="border-b bg-card p-3">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold" data-testid="text-map-title">Job Map</h1>
          </div>

          <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as "day" | "range")} className="ml-auto">
            <TabsList>
              <TabsTrigger value="day" data-testid="tab-filter-day">Single Day</TabsTrigger>
              <TabsTrigger value="range" data-testid="tab-filter-range">Date Range</TabsTrigger>
            </TabsList>
          </Tabs>

          {filterMode === "day" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDay(-1)} data-testid="button-prev-day">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
                data-testid="input-selected-date"
              />
              <Button variant="outline" size="icon" onClick={() => navigateDay(1)} data-testid="button-next-day">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}
                data-testid="button-today"
              >
                Today
              </Button>
            </div>
          )}

          {filterMode === "range" && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">From</Label>
              <Input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-40"
                data-testid="input-range-start"
              />
              <Label className="text-sm text-muted-foreground">To</Label>
              <Input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-40"
                data-testid="input-range-end"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Color by:</Label>
            <Button
              variant={colorBy === "status" ? "default" : "outline"}
              size="sm"
              onClick={() => setColorBy("status")}
              data-testid="button-color-status"
            >
              Status
            </Button>
            <Button
              variant={colorBy === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => setColorBy("day")}
              data-testid="button-color-day"
            >
              Day
            </Button>
          </div>
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
          <Card className="w-64">
            <CardContent className="p-3">
              <div className="text-sm font-medium mb-2" data-testid="text-job-summary">
                {totalJobs} job{totalJobs !== 1 ? "s" : ""} found
                {jobsWithoutCoords > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({jobsWithoutCoords} without location)
                  </span>
                )}
              </div>

              {colorBy === "status" && (
                <div className="space-y-1">
                  {Object.entries(STATUS_COLORS).map(([key, val]) => {
                    const count = jobs?.filter((j: any) => j.status === key).length || 0;
                    if (count === 0) return null;
                    return (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <div className={`w-3 h-3 rounded-full ${val.bg}`} />
                        <span className="text-muted-foreground">{val.label}</span>
                        <span className="ml-auto font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {colorBy === "day" && filterMode === "range" && (
                <div className="space-y-1">
                  {Object.entries(DAY_COLORS).map(([dayNum, color]) => {
                    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                    return (
                      <div key={dayNum} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                        <span className="text-muted-foreground">{dayNames[Number(dayNum)]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
