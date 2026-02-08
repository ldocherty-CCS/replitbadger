import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertJobSchema, type Job } from "@shared/schema";
import { useCreateJob, useUpdateJob, useCreateJobSeries } from "@/hooks/use-jobs";
import { useCustomers } from "@/hooks/use-customers";
import { useOperators } from "@/hooks/use-operators";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle as AlertTriangleIcon, ShieldCheck, Users, CalendarRange, CalendarOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTimeOff } from "@/hooks/use-time-off";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// Extend schema to handle string conversion for IDs
const formSchema = insertJobSchema.extend({
  customerId: z.coerce.number(),
  operatorId: z.coerce.number().optional().nullable(),
  assistantOperatorId: z.preprocess(
    (val) => (val === "none" || val === "" || val === undefined || val === null ? null : Number(val)),
    z.number().nullable().optional()
  ),
  additionalOperatorNeeded: z.boolean().default(false),
  manifestNeeded: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Job | null;
  defaultDate?: string;
  defaultOperatorId?: number | null;
}

export function CreateJobDialog({ 
  open, 
  onOpenChange, 
  initialData, 
  defaultDate,
  defaultOperatorId,
}: CreateJobDialogProps) {
  const { data: customers } = useCustomers();
  const { data: operators } = useOperators();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const createJobSeries = useCreateJobSeries();
  const { data: timeOffRecords } = useTimeOff();
  const { toast } = useToast();
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState("");

  const isEditing = !!initialData;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: 0,
      scope: "",
      address: "",
      startTime: "08:00 AM",
      status: "missing_info",
      scheduledDate: defaultDate || new Date().toISOString().split("T")[0],
      additionalOperatorNeeded: false,
      manifestNeeded: false,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        customerId: initialData.customerId ?? undefined,
        operatorId: initialData.operatorId ?? undefined,
        assistantOperatorId: initialData.assistantOperatorId ?? undefined,
        scheduledDate: initialData.scheduledDate,
      } as any);
      setIsMultiDay(false);
      setEndDate("");
    } else {
      form.reset({
        customerId: 0,
        scope: "",
        address: "",
        startTime: "08:00 AM",
        status: "missing_info",
        scheduledDate: defaultDate || new Date().toISOString().split("T")[0],
        operatorId: defaultOperatorId || undefined,
        additionalOperatorNeeded: false,
        manifestNeeded: false,
      });
      setIsMultiDay(false);
      setEndDate("");
    }
  }, [initialData, defaultDate, defaultOperatorId, form]);

  const watchedOperatorId = form.watch("operatorId");
  const watchedDate = form.watch("scheduledDate");

  const operatorOffDays = useMemo(() => {
    const offDays = new Set<string>();
    timeOffRecords?.forEach((record) => {
      const start = new Date(record.startDate + "T00:00:00");
      const end = new Date(record.endDate + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        offDays.add(`${record.operatorId}-${d.toISOString().split("T")[0]}`);
      }
    });
    if (watchedDate) {
      operators?.forEach((op) => {
        if (op.isOutOfState && (op.availableFrom || op.availableTo)) {
          if (op.availableFrom && watchedDate < op.availableFrom) {
            offDays.add(`${op.id}-${watchedDate}`);
          }
          if (op.availableTo && watchedDate > op.availableTo) {
            offDays.add(`${op.id}-${watchedDate}`);
          }
        }
      });
    }
    return offDays;
  }, [timeOffRecords, operators, watchedDate]);

  const isOperatorOff = useMemo(() => {
    if (!watchedOperatorId || !watchedDate) return false;
    return operatorOffDays.has(`${watchedOperatorId}-${watchedDate}`);
  }, [watchedOperatorId, watchedDate, operatorOffDays]);

  const onSubmit = async (values: FormValues) => {
    if (values.operatorId && values.scheduledDate && operatorOffDays.has(`${values.operatorId}-${values.scheduledDate}`)) {
      const opName = operators?.find(o => o.id === values.operatorId)?.name || "This operator";
      toast({ title: "Cannot Schedule", description: `${opName} has the day off on ${values.scheduledDate}. Remove their time off first.`, variant: "destructive" });
      return;
    }
    try {
      if (isEditing && initialData) {
        await updateJob.mutateAsync({ id: initialData.id, ...values });
      } else if (isMultiDay && endDate && endDate > values.scheduledDate) {
        const { scheduledDate, ...jobData } = values;
        await createJobSeries.mutateAsync({
          job: values,
          startDate: values.scheduledDate,
          endDate: endDate,
        });
      } else {
        await createJob.mutateAsync(values);
      }
      onOpenChange(false);
      form.reset();
      setIsMultiDay(false);
      setEndDate("");
    } catch (error) {
      // handled by mutation hook
    }
  };

  const isPending = createJob.isPending || updateJob.isPending || createJobSeries.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Job" : "New Job"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer */}
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="missing_info">Missing Info</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="dispatched">Dispatched</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                        <SelectItem value="ticket_created">Ticket Created</SelectItem>
                        <SelectItem value="not_qualified">Not Qualified</SelectItem>
                        <SelectItem value="standby">Standby (2nd Job)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scope */}
              <div className="col-span-1 md:col-span-2">
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scope of Work</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe the job scope..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address */}
              <div className="col-span-1 md:col-span-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Job site address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Date */}
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isMultiDay ? "Start Date" : "Date"}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-scheduled-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isEditing && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 mt-1">
                    <Checkbox
                      checked={isMultiDay}
                      onCheckedChange={(checked) => {
                        setIsMultiDay(!!checked);
                        if (!checked) setEndDate("");
                      }}
                      data-testid="checkbox-multi-day"
                    />
                    <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                      <CalendarRange className="w-4 h-4" />
                      Multi-day job
                    </label>
                  </div>
                  {isMultiDay && (
                    <div>
                      <label className="text-sm font-medium">End Date</label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={form.watch("scheduledDate")}
                        data-testid="input-end-date"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Time */}
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 08:00 AM" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Operator */}
              <FormField
                control={form.control}
                name="operatorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Operator (Optional)</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value ? field.value.toString() : "undefined"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="undefined">Unassigned</SelectItem>
                        {operators
                          ?.filter((op) => !(op as any).isAssistantOnly)
                          .map((op) => (
                          <SelectItem key={op.id} value={op.id.toString()}>
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isOperatorOff && (
                <div className="col-span-full flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30" data-testid="warning-operator-off">
                  <CalendarOff className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-sm text-destructive font-medium">
                    {operators?.find(o => o.id === watchedOperatorId)?.name || "This operator"} has the day off on this date. Remove their time off first to schedule here.
                  </span>
                </div>
              )}

              {/* Qualification Warning */}
              <QualificationWarning 
                customerId={form.watch("customerId")} 
                operatorId={form.watch("operatorId")} 
                customers={customers} 
                operators={operators} 
              />

              {/* Additional Operator */}
              <div className="col-span-1 md:col-span-2 space-y-3">
                <FormField
                  control={form.control}
                  name="additionalOperatorNeeded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue("assistantOperatorId", null);
                            }
                          }}
                          data-testid="checkbox-additional-operator"
                        />
                      </FormControl>
                      <FormLabel className="flex items-center gap-1.5 cursor-pointer">
                        <Users className="w-4 h-4" />
                        Additional operator needed
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch("additionalOperatorNeeded") && (
                  <FormField
                    control={form.control}
                    name="assistantOperatorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assistant Operator</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                          value={field.value ? field.value.toString() : "none"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-assistant-operator">
                              <SelectValue placeholder="Select assistant" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Not assigned yet</SelectItem>
                            {operators
                              ?.filter((op) => op.id !== form.watch("operatorId"))
                              .map((op) => (
                                <SelectItem key={op.id} value={op.id.toString()}>
                                  {op.name}
                                  {op.operatorType === "local_assistant" ? " (Assistant)" : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Contact Info */}
              <FormField
                control={form.control}
                name="onSiteContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Contact</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Name & Number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Job"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function QualificationWarning({ customerId, operatorId, customers, operators }: {
  customerId: number;
  operatorId: number | null | undefined;
  customers: any[] | undefined;
  operators: any[] | undefined;
}) {
  const warning = useMemo(() => {
    if (!customerId || !operatorId || !customers || !operators) return null;
    const customer = customers.find(c => c.id === customerId);
    const operator = operators.find(o => o.id === operatorId);
    if (!customer || !operator) return null;
    const required: string[] = customer.requiredQuals || [];
    const has: string[] = operator.qualifications || [];
    if (required.length === 0) return null;
    const missing = required.filter(q => !has.includes(q));
    if (missing.length === 0) return { ok: true, operator: operator.name };
    return { ok: false, missing, operator: operator.name, customer: customer.name };
  }, [customerId, operatorId, customers, operators]);

  if (!warning) return null;

  if (warning.ok) {
    return (
      <div className="col-span-1 md:col-span-2 flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 rounded-md p-2.5" data-testid="text-qual-ok">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>{warning.operator} meets all certification requirements</span>
      </div>
    );
  }

  return (
    <div className="col-span-1 md:col-span-2 rounded-md border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 p-2.5 space-y-1.5" data-testid="text-qual-warning">
      <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
        <AlertTriangleIcon className="w-4 h-4 shrink-0" />
        <span>{warning.operator} is missing required certifications for {warning.customer}</span>
      </div>
      <div className="flex flex-wrap gap-1 ml-6">
        {warning.missing?.map((q) => (
          <Badge key={q} variant="outline" className="text-[10px] border-orange-400 text-orange-700 dark:text-orange-300">
            {q}
          </Badge>
        ))}
      </div>
    </div>
  );
}
