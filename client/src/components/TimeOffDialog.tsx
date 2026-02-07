import { useState, useEffect } from "react";
import { useOperators } from "@/hooks/use-operators";
import { useTimeOff, useCreateTimeOff, useDeleteTimeOff, type TimeOffWithOperator } from "@/hooks/use-time-off";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, CalendarOff } from "lucide-react";
import { format, parseISO } from "date-fns";

interface TimeOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOperatorId?: number | null;
  defaultDate?: string;
}

export function TimeOffDialog({ open, onOpenChange, defaultOperatorId, defaultDate }: TimeOffDialogProps) {
  const { data: operators } = useOperators();
  const { data: timeOffRecords, isLoading } = useTimeOff();
  const createTimeOff = useCreateTimeOff();
  const deleteTimeOff = useDeleteTimeOff();

  const [operatorId, setOperatorId] = useState<string>(defaultOperatorId?.toString() || "");
  const [startDate, setStartDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      if (defaultOperatorId) setOperatorId(defaultOperatorId.toString());
      if (defaultDate) {
        setStartDate(defaultDate);
        setEndDate(defaultDate);
      }
    }
  }, [open, defaultOperatorId, defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId) return;
    await createTimeOff.mutateAsync({
      operatorId: Number(operatorId),
      startDate,
      endDate,
      reason: reason || null,
    });
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5" />
            Manage Time Off
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm font-medium">Operator</label>
              <Select value={operatorId} onValueChange={setOperatorId}>
                <SelectTrigger data-testid="select-timeoff-operator">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {operators?.map((op) => (
                    <SelectItem key={op.id} value={op.id.toString()}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  data-testid="input-timeoff-start"
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  data-testid="input-timeoff-end"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Vacation, Sick, Training"
                data-testid="input-timeoff-reason"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!operatorId || createTimeOff.isPending}
            className="w-full"
            data-testid="button-add-timeoff"
          >
            {createTimeOff.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add Time Off
          </Button>
        </form>

        <div className="border-t pt-4 mt-2">
          <h3 className="text-sm font-semibold mb-3">Scheduled Time Off</h3>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !timeOffRecords?.length ? (
            <p className="text-sm text-muted-foreground text-center py-3">No time off scheduled</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {timeOffRecords.map((record: TimeOffWithOperator) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-md border bg-muted/30"
                  data-testid={`timeoff-record-${record.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {record.operator?.name || "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(record.startDate), "MMM d, yyyy")}
                      {record.startDate !== record.endDate && (
                        <> — {format(parseISO(record.endDate), "MMM d, yyyy")}</>
                      )}
                      {record.reason && <span className="ml-1.5 italic">({record.reason})</span>}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteTimeOff.mutate(record.id)}
                    data-testid={`button-delete-timeoff-${record.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
