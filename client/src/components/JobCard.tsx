import { useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { MapPin, Clock, Briefcase, AlertTriangle, CheckCircle2, Copy, Trash2, Palette, ShieldAlert, Ban, RotateCcw, Users, Truck, UserCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Job, Customer, Operator } from "@shared/schema";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface JobCardProps {
  job: Job & { customer?: Customer; operator?: Operator; assistantOperator?: Operator; creator?: { id: string; firstName: string | null; lastName: string | null } | null };
  isOverlay?: boolean;
  compact?: boolean;
  isAssistantEntry?: boolean;
  jobIndex?: number;
  totalJobs?: number;
  sameLocationIndex?: number;
  sameLocationTotal?: number;
  onDuplicate?: (job: Job) => void;
  onDelete?: (job: Job) => void;
  onStatusChange?: (job: Job, status: string) => void;
  onCancel?: (job: Job) => void;
  onRestore?: (job: Job) => void;
}

const statusColors: Record<string, string> = {
  dispatched: "bg-[hsl(142,76%,36%)] border-[hsl(142,76%,36%)] text-white",
  unavailable: "bg-[hsl(0,84%,60%)] border-[hsl(0,84%,60%)] text-white",
  ready: "bg-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)] text-white",
  ticket_created: "bg-[hsl(199,89%,48%)] border-[hsl(199,89%,48%)] text-white",
  existing: "bg-[hsl(220,9%,46%)] border-[hsl(220,9%,46%)] text-white",
  missing_info: "bg-[hsl(330,81%,60%)] border-[hsl(330,81%,60%)] text-white",
  not_qualified: "bg-[hsl(24,94%,50%)] border-[hsl(24,94%,50%)] text-white",
  cancelled: "bg-[hsl(0,0%,55%)] border-[hsl(0,0%,55%)] text-white",
  standby: "bg-[hsl(270,60%,55%)] border-[hsl(270,60%,55%)] text-white",
};

const statusLabels: Record<string, string> = {
  dispatched: "Dispatched",
  unavailable: "Unavailable",
  ready: "Ready",
  ticket_created: "Ticket Created",
  existing: "Existing",
  missing_info: "Missing Info",
  not_qualified: "Not Qualified",
  cancelled: "Cancelled",
  standby: "Standby",
};

const statusDots: Record<string, string> = {
  dispatched: "bg-[hsl(142,76%,36%)]",
  unavailable: "bg-[hsl(0,84%,60%)]",
  ready: "bg-[hsl(217,91%,60%)]",
  ticket_created: "bg-[hsl(199,89%,48%)]",
  existing: "bg-[hsl(220,9%,46%)]",
  missing_info: "bg-[hsl(330,81%,60%)]",
  not_qualified: "bg-[hsl(24,94%,50%)]",
  cancelled: "bg-[hsl(0,0%,55%)]",
  standby: "bg-[hsl(270,60%,55%)]",
};

let _contextActionTimestamp = 0;
export function wasContextAction() { return Date.now() - _contextActionTimestamp < 300; }

export function JobCard({ job, isOverlay, compact, isAssistantEntry, jobIndex, totalJobs, sameLocationIndex, sameLocationTotal, onDuplicate, onDelete, onStatusChange, onCancel, onRestore }: JobCardProps) {
  const draggableId = isAssistantEntry ? `job-${job.id}-assist` : `job-${job.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    disabled: isAssistantEntry,
    data: { 
      type: "Job", 
      job 
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const statusColorClass = isAssistantEntry
    ? "bg-[hsl(30,90%,50%)] border-[hsl(30,90%,50%)] text-white"
    : statusColors[job.status] || "bg-gray-400 border-gray-400 text-white";
  const hasContextMenu = !isOverlay && !isAssistantEntry && (onDuplicate || onDelete || onStatusChange || onCancel || onRestore);

  const missingQuals = (() => {
    const required: string[] = (job.customer as any)?.requiredQuals || [];
    const has: string[] = (job as any).operator?.qualifications || [];
    if (required.length === 0 || !job.operatorId) return [];
    return required.filter(q => !has.includes(q));
  })();

  const innerCard = (
    <Card className={cn(
      "overflow-hidden shadow-sm hover:shadow-md transition-shadow",
      statusColorClass,
      isAssistantEntry && "opacity-80 border-dashed border-2"
    )}>
      <CardContent className="p-1.5 space-y-0.5">
        {isAssistantEntry && (
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide opacity-90 mb-0.5" data-testid={`badge-assisting-${job.id}`}>
            <Users className="w-2.5 h-2.5" />
            Assisting
          </div>
        )}
        <h4 className="font-bold text-xs leading-tight line-clamp-1" data-testid={`text-customer-${job.id}`}>
          {totalJobs && totalJobs > 1 && jobIndex != null && (
            <span className="mr-1 font-black opacity-80" data-testid={`text-job-order-${job.id}`}>{jobIndex + 1}.</span>
          )}
          {job.customerId ? (job.customer?.name || "Unknown Customer") : (job.scope || "Dispatch Note")}
        </h4>

        <div className="flex items-center gap-1 text-[11px] opacity-90">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="line-clamp-1">{job.address}</span>
          {sameLocationTotal && sameLocationTotal > 1 && sameLocationIndex != null && (
            <span
              className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold bg-white/25 rounded px-1 py-0.5"
              title={`${sameLocationTotal} trucks at this location`}
              data-testid={`badge-location-count-${job.id}`}
            >
              <Truck className="w-2.5 h-2.5" />
              {sameLocationIndex + 1}/{sameLocationTotal}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1 text-[11px] font-medium opacity-90">
            <Clock className="w-3 h-3" />
            {job.startTime}
          </div>
          
          <div className="flex gap-0.5">
            {missingQuals.length > 0 && (
              <div title={`Missing: ${missingQuals.join(", ")}`} className="opacity-90" data-testid={`icon-missing-quals-${job.id}`}>
                <ShieldAlert className="w-3 h-3" />
              </div>
            )}
            {job.manifestNeeded && (
              <div title="Manifest Needed" className="opacity-90">
                <AlertTriangle className="w-3 h-3" />
              </div>
            )}
            {job.ticketCreated && (
              <div title="Ticket Created" className="opacity-90">
                <CheckCircle2 className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>

        {job.additionalOperatorNeeded && (
          <div className="flex items-center gap-1 text-[10px] opacity-90" data-testid={`assistant-info-${job.id}`}>
            <Users className="w-3 h-3 shrink-0" />
            {job.assistantOperator ? (
              <span className="font-medium line-clamp-1" data-testid={`text-assistant-${job.id}`}>
                + {job.assistantOperator.name}
              </span>
            ) : (
              <span className="italic font-medium" data-testid={`text-needs-assistant-${job.id}`}>
                Needs assistant
              </span>
            )}
          </div>
        )}

        {(job as any).creator && (
          <div className="flex items-center gap-1 text-[10px] opacity-70" data-testid={`text-created-by-${job.id}`}>
            <UserCircle className="w-3 h-3 shrink-0" />
            <span className="line-clamp-1">
              {[(job as any).creator.firstName, (job as any).creator.lastName].filter(Boolean).join(" ") || "Unknown"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (hasContextMenu) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={cn(
              "touch-none group relative mb-1 transition-all duration-200",
              isDragging ? "opacity-50 rotate-2 scale-105 z-50" : "hover:-translate-y-0.5 z-0",
            )}
            data-testid={`card-job-${job.id}`}
          >
            {innerCard}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52" data-testid={`context-menu-job-${job.id}`}>
          {onDuplicate && (
            <ContextMenuItem
              onClick={() => { _contextActionTimestamp = Date.now(); onDuplicate(job); }}
              data-testid={`menu-duplicate-job-${job.id}`}
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate Job
            </ContextMenuItem>
          )}
          {onStatusChange && (
            <ContextMenuSub>
              <ContextMenuSubTrigger data-testid={`menu-change-status-${job.id}`}>
                <Palette className="w-4 h-4 mr-2" />
                Change Status
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48" data-testid="submenu-status-options">
                {Object.entries(statusLabels)
                  .filter(([key]) => key !== "cancelled" && key !== "standby")
                  .map(([key, label]) => (
                  <ContextMenuItem
                    key={key}
                    onClick={() => { _contextActionTimestamp = Date.now(); onStatusChange(job, key); }}
                    className={cn(job.status === key && "font-bold")}
                    data-testid={`menu-status-${key}`}
                  >
                    <div className={cn("w-3 h-3 rounded-full mr-2 shrink-0", statusDots[key])} />
                    {label}
                    {job.status === key && <span className="ml-auto text-xs text-muted-foreground">(current)</span>}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          {onCancel && job.status !== "cancelled" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => { _contextActionTimestamp = Date.now(); onCancel(job); }}
                data-testid={`menu-cancel-job-${job.id}`}
              >
                <Ban className="w-4 h-4 mr-2" />
                Cancel Job
              </ContextMenuItem>
            </>
          )}
          {onRestore && job.status === "cancelled" && (
            <ContextMenuItem
              onClick={() => { _contextActionTimestamp = Date.now(); onRestore(job); }}
              data-testid={`menu-restore-job-${job.id}`}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore Job
            </ContextMenuItem>
          )}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => { _contextActionTimestamp = Date.now(); onDelete(job); }}
                className="text-destructive focus:text-destructive"
                data-testid={`menu-delete-job-${job.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Job
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none group relative mb-1 transition-all duration-200",
        isDragging ? "opacity-50 rotate-2 scale-105 z-50" : "hover:-translate-y-0.5 z-0",
        isOverlay && "rotate-2 scale-105 shadow-2xl z-50 cursor-grabbing"
      )}
      data-testid={`card-job-${job.id}`}
    >
      {innerCard}
    </div>
  );
}
