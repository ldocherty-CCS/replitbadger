import { useState, useEffect } from "react";
import { useOperators } from "@/hooks/use-operators";
import { useTimeOff, useCreateTimeOff, useDeleteTimeOff, useRemoveTimeOffDay, type TimeOffWithOperator } from "@/hooks/use-time-off";
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
import { Loader2, Trash2, CalendarOff, X, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { formatOperatorFullName } from "@/lib/utils";

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
  const removeDay = useRemoveTimeOffDay();

  const [operatorId, setOperatorId] = useState<string>(defaultOperatorId?.toString() || "");
  const [startDate, setStartDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [expandedRecord, setExpandedRecord] = useState<number | null>(null);

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

  const getDaysInRange = (start: string, end: string): string[] => {
    const days: string[] = [];
    const startD = parseISO(start);
    const endD = parseISO(end);
    const count = differenceInDays(endD, startD) + 1;
    for (let i = 0; i < count; i++) {
      days.push(format(addDays(startD, i), "yyyy-MM-dd"));
    }
    return days;
  };

  const isMultiDay = (record: TimeOffWithOperator) => record.startDate !== record.endDate;

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
                      {formatOperatorFullName(op)}
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
              {timeOffRecords.map((record: TimeOffWithOperator) => {
                const multi = isMultiDay(record);
                const isExpanded = expandedRecord === record.id;
                const days = multi ? getDaysInRange(record.startDate, record.endDate) : [];

                return (
                  <div
                    key={record.id}
                    className="rounded-md border bg-muted/30"
                    data-testid={`timeoff-record-${record.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 p-2.5">
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        {multi && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                            data-testid={`button-expand-timeoff-${record.id}`}
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {record.operator ? formatOperatorFullName(record.operator) : "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(record.startDate), "MMM d, yyyy")}
                            {record.startDate !== record.endDate && (
                              <> — {format(parseISO(record.endDate), "MMM d, yyyy")} ({days.length} days)</>
                            )}
                            {record.reason && <span className="ml-1.5 italic">({record.reason})</span>}
                          </div>
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

                    {multi && isExpanded && (
                      <div className="px-3 pb-2.5 pt-0 border-t mt-0">
                        <div className="text-[11px] text-muted-foreground mb-1.5 mt-2">Remove individual days:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {days.map((day) => (
                            <div
                              key={day}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-background"
                              data-testid={`timeoff-day-${record.id}-${day}`}
                            >
                              <span>{format(parseISO(day), "EEE M/d")}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 ml-0.5"
                                onClick={() => removeDay.mutate({ id: record.id, date: day })}
                                disabled={removeDay.isPending}
                                data-testid={`button-remove-day-${record.id}-${day}`}
                              >
                                <X className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
