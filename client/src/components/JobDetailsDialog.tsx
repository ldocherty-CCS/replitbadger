import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, FileText, Phone, UserCircle, Briefcase, Pencil, ShieldAlert, AlertTriangle, CheckCircle2, Hash } from "lucide-react";
import type { Job, Customer, Operator } from "@shared/schema";
import { format, parseISO } from "date-fns";

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
            <DetailRow icon={<Users className="w-4 h-4" />} label="Operator" value={job.operator?.name || "Unassigned"} testId="detail-operator" />
            {job.additionalOperatorNeeded && (
              <DetailRow
                icon={<Users className="w-4 h-4" />}
                label="Assistant"
                value={job.assistantOperator?.name || "Needs assignment"}
                testId="detail-assistant"
              />
            )}
          </div>

          {(job.onSiteContact || job.requestorContact) && (
            <div className="grid grid-cols-2 gap-4">
              {job.onSiteContact && (
                <DetailRow icon={<Phone className="w-4 h-4" />} label="On-Site Contact" value={job.onSiteContact} testId="detail-onsite-contact" />
              )}
              {job.requestorContact && (
                <DetailRow icon={<Phone className="w-4 h-4" />} label="Requestor" value={job.requestorContact} testId="detail-requestor" />
              )}
            </div>
          )}

          {(job.billingInfo || job.poNumber) && (
            <div className="grid grid-cols-2 gap-4">
              {job.billingInfo && (
                <DetailRow icon={<FileText className="w-4 h-4" />} label="Billing" value={job.billingInfo} testId="detail-billing" />
              )}
              {job.poNumber && (
                <DetailRow icon={<Hash className="w-4 h-4" />} label="PO Number" value={job.poNumber} testId="detail-po" />
              )}
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
