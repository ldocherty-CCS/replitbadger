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
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Loader2, AlertTriangle as AlertTriangleIcon, ShieldCheck, Users, CalendarRange, CalendarOff, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTimeOff } from "@/hooks/use-time-off";
import { useAllOperatorAvailability } from "@/hooks/use-operator-availability";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatOperatorFullName } from "@/lib/utils";

const formSchema = insertJobSchema.extend({
  customerId: z.coerce.number(),
  operatorId: z.coerce.number().optional().nullable(),
  assistantOperatorId: z.preprocess(
    (val) => (val === "none" || val === "" || val === undefined || val === null ? null : Number(val)),
    z.number().nullable().optional()
  ),
  remoteHoseOperatorId: z.preprocess(
    (val) => (val === "none" || val === "" || val === undefined || val === null ? null : Number(val)),
    z.number().nullable().optional()
  ),
  additionalOperatorNeeded: z.boolean().default(false),
  manifestNeeded: z.boolean().default(false),
  remoteHose: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Job | null;
  defaultDate?: string;
  defaultOperatorId?: number | null;
  defaultStatus?: string;
}

export function CreateJobDialog({ 
  open, 
  onOpenChange, 
  initialData, 
  defaultDate,
  defaultOperatorId,
  defaultStatus,
}: CreateJobDialogProps) {
  const { data: customers } = useCustomers();
  const { data: operators } = useOperators();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const createJobSeries = useCreateJobSeries();
  const { data: timeOffRecords } = useTimeOff();
  const { data: availabilityRecords } = useAllOperatorAvailability();
  const { toast } = useToast();
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [jobLat, setJobLat] = useState<number | null>(null);
  const [jobLng, setJobLng] = useState<number | null>(null);

  const isEditing = !!initialData;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: 0,
      scope: "",
      address: "",
      startTime: "07:00 AM",
      status: defaultStatus || "missing_info",
      scheduledDate: defaultDate || new Date().toISOString().split("T")[0],
      additionalOperatorNeeded: false,
      manifestNeeded: false,
      remoteHose: false,
      remoteHoseLength: "",
      remoteHoseOperatorId: null,
      water: "",
      dump: "",
      srNumber: "",
      requestorContact: "",
      onSiteContact: "",
      poNumber: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        customerId: initialData.customerId ?? undefined,
        operatorId: initialData.operatorId ?? undefined,
        assistantOperatorId: initialData.assistantOperatorId ?? undefined,
        remoteHoseOperatorId: (initialData as any).remoteHoseOperatorId ?? null,
        scheduledDate: initialData.scheduledDate,
        remoteHose: (initialData as any).remoteHose ?? false,
        remoteHoseLength: (initialData as any).remoteHoseLength ?? "",
        water: (initialData as any).water ?? "",
        dump: (initialData as any).dump ?? "",
        srNumber: (initialData as any).srNumber ?? "",
        requestorContact: initialData.requestorContact ?? "",
        onSiteContact: initialData.onSiteContact ?? "",
        poNumber: initialData.poNumber ?? "",
      } as any);
      setIsMultiDay(false);
      setEndDate("");
      setJobLat((initialData as any)?.lat ?? null);
      setJobLng((initialData as any)?.lng ?? null);
    } else {
      form.reset({
        customerId: 0,
        scope: "",
        address: "",
        startTime: "07:00 AM",
        status: defaultStatus || "missing_info",
        scheduledDate: defaultDate || new Date().toISOString().split("T")[0],
        operatorId: defaultOperatorId || undefined,
        additionalOperatorNeeded: false,
        manifestNeeded: false,
        remoteHose: false,
        remoteHoseLength: "",
        remoteHoseOperatorId: null,
        water: "",
        dump: "",
        srNumber: "",
        requestorContact: "",
        onSiteContact: "",
        poNumber: "",
      });
      setIsMultiDay(false);
      setEndDate("");
      setJobLat(null);
      setJobLng(null);
    }
  }, [initialData, defaultDate, defaultOperatorId, defaultStatus, form]);

  const watchedOperatorId = form.watch("operatorId");
  const watchedDate = form.watch("scheduledDate");
  const watchedRemoteHose = form.watch("remoteHose");

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
        if (op.isOutOfState) {
          const opAvailWindows = availabilityRecords?.filter((r) => r.operatorId === op.id) || [];
          if (opAvailWindows.length > 0) {
            const isAvailable = opAvailWindows.some(
              (w) => watchedDate >= w.startDate && watchedDate <= w.endDate
            );
            if (!isAvailable) {
              offDays.add(`${op.id}-${watchedDate}`);
            }
          } else if (op.availableFrom || op.availableTo) {
            if (op.availableFrom && watchedDate < op.availableFrom) {
              offDays.add(`${op.id}-${watchedDate}`);
            }
            if (op.availableTo && watchedDate > op.availableTo) {
              offDays.add(`${op.id}-${watchedDate}`);
            }
          }
        }
      });
    }
    return offDays;
  }, [timeOffRecords, operators, availabilityRecords, watchedDate]);

  const isOperatorOff = useMemo(() => {
    if (!watchedOperatorId || !watchedDate) return false;
    return operatorOffDays.has(`${watchedOperatorId}-${watchedDate}`);
  }, [watchedOperatorId, watchedDate, operatorOffDays]);

  const handleCopyRequestorToContact = () => {
    const requestor = form.getValues("requestorContact");
    if (requestor) {
      form.setValue("onSiteContact", requestor);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (values.operatorId && values.scheduledDate && operatorOffDays.has(`${values.operatorId}-${values.scheduledDate}`)) {
      const opName = operators?.find(o => o.id === values.operatorId)?.name || "This operator";
      toast({ title: "Cannot Schedule", description: `${opName} has the day off on ${values.scheduledDate}. Remove their time off first.`, variant: "destructive" });
      return;
    }
    if (!values.remoteHose) {
      values.remoteHoseLength = "";
      values.remoteHoseOperatorId = null;
    }
    const valuesWithCoords = { ...values, lat: jobLat, lng: jobLng };
    try {
      if (isEditing && initialData) {
        await updateJob.mutateAsync({ id: initialData.id, ...valuesWithCoords });
      } else if (isMultiDay && endDate && endDate > values.scheduledDate) {
        await createJobSeries.mutateAsync({
          job: valuesWithCoords,
          startDate: values.scheduledDate,
          endDate: endDate,
        });
      } else {
        await createJob.mutateAsync(valuesWithCoords);
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Row 1: Customer + Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <SelectTrigger data-testid="select-customer">
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

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
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
            </div>

            {/* Row 2: Requestor + On Site Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requestorContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requestor</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Requestor name & number" data-testid="input-requestor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="onSiteContact"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormLabel>On Site Contact</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-muted-foreground"
                        onClick={handleCopyRequestorToContact}
                        data-testid="button-copy-requestor"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Same as Requestor
                      </Button>
                    </div>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="On-site contact name & number" data-testid="input-onsite-contact" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: Address (full width) */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <AddressAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      onPlaceSelect={(result) => {
                        field.onChange(result.address);
                        setJobLat(result.lat);
                        setJobLng(result.lng);
                      }}
                      placeholder="Search for job site address..."
                      data-testid="input-job-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 4: Date + Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
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
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isMultiDay}
                      onCheckedChange={(checked) => {
                        setIsMultiDay(!!checked);
                        if (!checked) setEndDate("");
                      }}
                      data-testid="checkbox-multi-day"
                    />
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <CalendarRange className="w-3.5 h-3.5" />
                      Multi-day job
                    </label>
                    {isMultiDay && (
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={form.watch("scheduledDate")}
                        className="w-auto"
                        data-testid="input-end-date"
                      />
                    )}
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 08:00 AM" data-testid="input-start-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 5: Job # / PO # + SR # */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="poNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job # / PO #</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Job or PO number" data-testid="input-po-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="srNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SR #</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="SR number" data-testid="input-sr-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 6: Remote Hose */}
            <div className="space-y-2">
              <div className="flex items-center gap-4 flex-wrap">
                <FormField
                  control={form.control}
                  name="remoteHose"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            const isChecked = !!checked;
                            field.onChange(isChecked);
                            if (isChecked) {
                              form.setValue("additionalOperatorNeeded", true);
                            } else {
                              form.setValue("remoteHoseOperatorId", null);
                              form.setValue("remoteHoseLength", "");
                            }
                          }}
                          data-testid="checkbox-remote-hose"
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Remote Hose</FormLabel>
                    </FormItem>
                  )}
                />

                {watchedRemoteHose && (
                  <FormField
                    control={form.control}
                    name="remoteHoseLength"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormLabel className="whitespace-nowrap text-sm">Length:</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="e.g. 200ft" className="w-24" data-testid="input-remote-hose-length" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Row 7: Water + Dump */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="water"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Water</FormLabel>
                    <div className="flex gap-0">
                      <Button
                        type="button"
                        variant={field.value === "on_site" ? "default" : "outline"}
                        className="rounded-r-none flex-1"
                        onClick={() => field.onChange(field.value === "on_site" ? "" : "on_site")}
                        data-testid="toggle-water-onsite"
                      >
                        On Site
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === "off_site" ? "default" : "outline"}
                        className="rounded-l-none flex-1 border-l-0"
                        onClick={() => field.onChange(field.value === "off_site" ? "" : "off_site")}
                        data-testid="toggle-water-offsite"
                      >
                        Off Site
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dump"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dump</FormLabel>
                    <div className="flex gap-0">
                      <Button
                        type="button"
                        variant={field.value === "on_site" ? "default" : "outline"}
                        className="rounded-r-none flex-1"
                        onClick={() => field.onChange(field.value === "on_site" ? "" : "on_site")}
                        data-testid="toggle-dump-onsite"
                      >
                        On Site
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === "off_site" ? "default" : "outline"}
                        className="rounded-l-none flex-1 border-l-0"
                        onClick={() => field.onChange(field.value === "off_site" ? "" : "off_site")}
                        data-testid="toggle-dump-offsite"
                      >
                        Off Site
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 8: Scope of Work (full width) */}
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope of Work</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describe the job scope..." data-testid="input-scope" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 9: Operator assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <SelectTrigger data-testid="select-operator">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="undefined">Unassigned</SelectItem>
                        {operators
                          ?.filter((op) => !(op as any).isAssistantOnly && (op as any).operatorType !== "assistant")
                          .map((op) => (
                          <SelectItem key={op.id} value={op.id.toString()}>
                            {formatOperatorFullName(op)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="additionalOperatorNeeded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0 mt-7">
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
                                  {formatOperatorFullName(op)}
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
            </div>

            {isOperatorOff && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30" data-testid="warning-operator-off">
                <CalendarOff className="w-4 h-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive font-medium">
                  {(() => { const op = operators?.find(o => o.id === watchedOperatorId); return op ? formatOperatorFullName(op) : "This operator"; })()} has the day off on this date. Remove their time off first to schedule here.
                </span>
              </div>
            )}

            <QualificationWarning 
              customerId={form.watch("customerId")} 
              operatorId={form.watch("operatorId")} 
              customers={customers} 
              operators={operators} 
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-job">
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
    if (missing.length === 0) return { ok: true, operator: formatOperatorFullName(operator) };
    return { ok: false, missing, operator: formatOperatorFullName(operator), customer: customer.name };
  }, [customerId, operatorId, customers, operators]);

  if (!warning) return null;

  if (warning.ok) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 rounded-md p-2.5" data-testid="text-qual-ok">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>{warning.operator} meets all certification requirements</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 p-2.5 space-y-1.5" data-testid="text-qual-warning">
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
