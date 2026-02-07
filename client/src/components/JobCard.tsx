import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { MapPin, Clock, Briefcase, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Job, Customer } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface JobCardProps {
  job: Job & { customer?: Customer };
  isOverlay?: boolean;
}

const statusColors: Record<string, string> = {
  dispatched: "bg-[hsl(142,76%,36%)] border-[hsl(142,76%,36%)] text-white",
  unavailable: "bg-[hsl(0,84%,60%)] border-[hsl(0,84%,60%)] text-white",
  ready: "bg-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)] text-white",
  ticket_created: "bg-[hsl(199,89%,48%)] border-[hsl(199,89%,48%)] text-white",
  existing: "bg-[hsl(220,9%,46%)] border-[hsl(220,9%,46%)] text-white",
  missing_info: "bg-[hsl(330,81%,60%)] border-[hsl(330,81%,60%)] text-white",
  not_qualified: "bg-[hsl(24,94%,50%)] border-[hsl(24,94%,50%)] text-white",
};

const statusLabels: Record<string, string> = {
  dispatched: "Dispatched",
  unavailable: "Unavailable",
  ready: "Ready",
  ticket_created: "Ticket Created",
  existing: "Existing",
  missing_info: "Missing Info",
  not_qualified: "Not Qualified",
};

export function JobCard({ job, isOverlay }: JobCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job-${job.id}`,
    data: { 
      type: "Job", 
      job 
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const statusColorClass = statusColors[job.status] || "bg-gray-400 border-gray-400 text-white";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none group relative mb-2 transition-all duration-200",
        isDragging ? "opacity-50 rotate-2 scale-105 z-50" : "hover:-translate-y-0.5 z-0",
        isOverlay && "rotate-2 scale-105 shadow-2xl z-50 cursor-grabbing"
      )}
    >
      <Card className={cn(
        "overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-shadow bg-card",
        statusColorClass.replace('bg-', 'border-l-') // Dynamic border color
      )}>
        <CardContent className="p-2.5 space-y-2">
          {/* Header with Status Badge */}
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-bold text-sm leading-tight text-foreground line-clamp-2">
              {job.customer?.name || "Unknown Customer"}
            </h4>
            <div className={cn(
              "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap",
              statusColorClass
            )}>
              {statusLabels[job.status] || job.status}
            </div>
          </div>

          {/* Scope */}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Briefcase className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-2 leading-snug">{job.scope}</span>
          </div>

          {/* Location */}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-1">{job.address}</span>
          </div>

          {/* Time & Warnings Footer */}
          <div className="flex justify-between items-center pt-1 border-t border-border/50">
            <div className="flex items-center gap-1 text-xs font-medium text-foreground/80">
              <Clock className="w-3.5 h-3.5" />
              {job.startTime}
            </div>
            
            <div className="flex gap-1">
              {job.manifestNeeded && (
                <div title="Manifest Needed" className="text-amber-500">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              )}
              {job.ticketCreated && (
                <div title="Ticket Created" className="text-blue-500">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
