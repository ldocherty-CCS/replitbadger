import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, FileText, Phone, UserCircle, Briefcase, Pencil, ShieldAlert, AlertTriangle, CheckCircle2, Hash, Droplets, Trash2, Cable, ClipboardList } from "lucide-react";
import type { Job, Customer, Operator } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { formatOperatorFullName } from "@/lib/utils";

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

const statusColors: Record<string, string> = {
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

interface JobDetailsDialogProps {
  job: (Job & { customer?: Customer; operator?: Operator; assistantOperator?: Operator; creator?: { id: string; firstName: string | null; lastName: string | null } | null }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (job: Job) => void;
}

export function JobDetailsDialog({ job, open, onOpenChange, onEdit }: JobDetailsDialogProps) {
  if (!job) return null;

  const statusLabel = statusLabels[job.status] || job.status;
  const statusColor = statusColors[job.status] || "bg-gray-400";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-job-details">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-lg" data-testid="text-job-details-title">
              {job.customerId ? (job.customer?.name || "Unknown Customer") : (job.scope || "Dispatch Note")}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className={`${statusColor} text-white border-0`} data-testid="badge-job-status">
                {statusLabel}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(job)}
                data-testid="button-edit-job"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow icon={<Briefcase className="w-4 h-4" />} label="Scope" value={job.scope} testId="detail-scope" />
            <DetailRow
              icon={<Clock className="w-4 h-4" />}
              label="Date & Time"
              value={`${format(parseISO(job.scheduledDate), "EEE, MMM d, yyyy")} at ${job.startTime}`}
              testId="detail-date-time"
            />
          </div>

          <DetailRow icon={<MapPin className="w-4 h-4" />} label="Address" value={job.address} testId="detail-address" />

          <div className="grid grid-cols-2 gap-4">
            <DetailRow icon={<Users className="w-4 h-4" />} label="Operator" value={job.operator ? formatOperatorFullName(job.operator) : "Unassigned"} testId="detail-operator" />
            {job.additionalOperatorNeeded && (
              <DetailRow
                icon={<Users className="w-4 h-4" />}
                label="Assistant"
                value={job.assistantOperator ? formatOperatorFullName(job.assistantOperator) : "Needs assignment"}
                testId="detail-assistant"
              />
            )}
          </div>

          {(job.onSiteContact || job.requestorContact) && (
            <div className="grid grid-cols-2 gap-4">
              {job.requestorContact && (
                <DetailRow icon={<Phone className="w-4 h-4" />} label="Requestor" value={job.requestorContact} testId="detail-requestor" />
              )}
              {job.onSiteContact && (
                <DetailRow icon={<Phone className="w-4 h-4" />} label="On-Site Contact" value={job.onSiteContact} testId="detail-onsite-contact" />
              )}
            </div>
          )}

          {(job.poNumber || (job as any).srNumber) && (
            <div className="grid grid-cols-2 gap-4">
              {job.poNumber && (
                <DetailRow icon={<Hash className="w-4 h-4" />} label="Job # / PO #" value={job.poNumber} testId="detail-po" />
              )}
              {(job as any).srNumber && (
                <DetailRow icon={<FileText className="w-4 h-4" />} label="SR #" value={(job as any).srNumber} testId="detail-sr" />
              )}
            </div>
          )}

          {((job as any).water || (job as any).dump) && (
            <div className="grid grid-cols-2 gap-4">
              {(job as any).water && (
                <DetailRow icon={<Droplets className="w-4 h-4" />} label="Water" value={(job as any).water === "on_site" ? "On Site" : "Off Site"} testId="detail-water" />
              )}
              {(job as any).dump && (
                <DetailRow icon={<Trash2 className="w-4 h-4" />} label="Dump" value={(job as any).dump === "on_site" ? "On Site" : "Off Site"} testId="detail-dump" />
              )}
            </div>
          )}

          {(job as any).remoteHose && (
            <div className="grid grid-cols-2 gap-4">
              <DetailRow icon={<Cable className="w-4 h-4" />} label="Remote Hose" value={(job as any).remoteHoseLength ? `Yes - ${(job as any).remoteHoseLength}` : "Yes"} testId="detail-remote-hose" />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {job.ticketCreated && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="detail-ticket-created">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Ticket Created
              </div>
            )}
            {job.manifestNeeded && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="detail-manifest-needed">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Manifest Needed
              </div>
            )}
          </div>

          {job.manifestNeeded && ((job as any).manifestNumber || (job as any).manifestDumpLocation || ((job as any).scheduledDumpTimes && (job as any).scheduledDumpTimes.length > 0)) && (
            <div className="space-y-3 pl-4 border-l-2 border-amber-500/30">
              {(job as any).manifestNumber && (
                <DetailRow icon={<Hash className="w-4 h-4" />} label="Manifest #" value={(job as any).manifestNumber} testId="detail-manifest-number" />
              )}
              {((job as any).manifestDumpLocationName || (job as any).manifestDumpLocation) && (
                <div data-testid="detail-manifest-dump-location">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <MapPin className="w-4 h-4" />
                    Dump Location
                  </div>
                  <div className="pl-6">
                    {(job as any).manifestDumpLocationName && (
                      <div className="text-sm font-medium" data-testid="text-dump-location-name">{(job as any).manifestDumpLocationName}</div>
                    )}
                    <div className="text-sm text-muted-foreground" data-testid="text-dump-location-address">{(job as any).manifestDumpLocation}</div>
                  </div>
                </div>
              )}
              {(job as any).scheduledDumpTimes && (job as any).scheduledDumpTimes.length > 0 && (
                <div className="space-y-1" data-testid="detail-scheduled-dump-times">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <ClipboardList className="w-4 h-4" />
                    Scheduled Dump Times
                  </div>
                  <div className="pl-6 space-y-0.5">
                    {(job as any).scheduledDumpTimes.map((time: string, idx: number) => (
                      <div key={idx} className="text-sm font-medium" data-testid={`text-dump-time-${idx}`}>{time}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(job as any).creator && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="detail-created-by">
                <UserCircle className="w-4 h-4" />
                Created by {[(job as any).creator.firstName, (job as any).creator.lastName].filter(Boolean).join(" ") || "Unknown"}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId?: string }) {
  return (
    <div className="space-y-1" data-testid={testId}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium pl-6">{value}</div>
    </div>
  );
}
