import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertJobSchema, type Job, type CustomerContact, type DumpLocation } from "@shared/schema";
import { useCreateJob, useUpdateJob, useCreateJobSeries } from "@/hooks/use-jobs";
import { useCustomers } from "@/hooks/use-customers";
import { useOperators } from "@/hooks/use-operators";
import { useCustomerContacts } from "@/hooks/use-customer-contacts";
import { useDumpLocations, useCreateDumpLocation } from "@/hooks/use-dump-locations";
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
import { Loader2, AlertTriangle as AlertTriangleIcon, ShieldCheck, Users, CalendarRange, CalendarOff, Copy, Clock, MapPin, FileText, Truck, Droplets, Search, Phone, X, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useTimeOff } from "@/hooks/use-time-off";
import { useAllOperatorAvailability } from "@/hooks/use-operator-availability";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatOperatorFullName } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "missing_info", label: "Missing Info", color: "hsl(330 80% 60%)" },
  { value: "ready", label: "Ready", color: "hsl(217 91% 60%)" },
  { value: "dispatched", label: "Dispatched", color: "hsl(142 71% 45%)" },
  { value: "unavailable", label: "Unavailable", color: "hsl(0 84% 60%)" },
  { value: "ticket_created", label: "Ticket Created", color: "hsl(199 89% 48%)" },
  { value: "not_qualified", label: "Not Qualified", color: "hsl(25 95% 53%)" },
  { value: "standby", label: "Standby (2nd Job)", color: "hsl(271 81% 56%)" },
];

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
  manifestNumber: z.string().optional().nullable(),
  manifestDumpLocation: z.string().optional().nullable(),
  manifestDumpLocationName: z.string().optional().nullable(),
  scheduledDumpTimes: z.array(z.string()).optional().nullable(),
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
  const { data: dumpLocations } = useDumpLocations();
  const createDumpLocation = useCreateDumpLocation();
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [jobLat, setJobLat] = useState<number | null>(null);
  const [jobLng, setJobLng] = useState<number | null>(null);
  const [showNewDumpLocation, setShowNewDumpLocation] = useState(false);
  const [newDumpName, setNewDumpName] = useState("");
  const [newDumpAddress, setNewDumpAddress] = useState("");

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
      water: "off_site",
      dump: "off_site",
      srNumber: "",
      requestorContact: "",
      onSiteContact: "",
      poNumber: "",
      manifestNumber: "",
      manifestDumpLocation: "",
      manifestDumpLocationName: "",
      scheduledDumpTimes: [],
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
        water: (initialData as any).water || "off_site",
        dump: (initialData as any).dump || "off_site",
        srNumber: (initialData as any).srNumber ?? "",
        requestorContact: initialData.requestorContact ?? "",
        onSiteContact: initialData.onSiteContact ?? "",
        poNumber: initialData.poNumber ?? "",
        manifestNumber: (initialData as any).manifestNumber ?? "",
        manifestDumpLocation: (initialData as any).manifestDumpLocation ?? "",
        manifestDumpLocationName: (initialData as any).manifestDumpLocationName ?? "",
        scheduledDumpTimes: (initialData as any).scheduledDumpTimes ?? [],
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
        water: "off_site",
        dump: "off_site",
        srNumber: "",
        requestorContact: "",
        onSiteContact: "",
        poNumber: "",
        manifestNumber: "",
        manifestDumpLocation: "",
        manifestDumpLocationName: "",
        scheduledDumpTimes: [],
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
  const watchedManifestNeeded = form.watch("manifestNeeded");
  const watchedStatus = form.watch("status");

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

  const operatorHasDayOff = useCallback((operatorId: number, date: string) => {
    if (!date) return false;
    if (timeOffRecords?.some((r) => r.operatorId === operatorId && date >= r.startDate && date <= r.endDate)) {
      return true;
    }
    const op = operators?.find(o => o.id === operatorId);
    if (op?.isOutOfState) {
      const opWindows = availabilityRecords?.filter(r => r.operatorId === operatorId) || [];
      if (opWindows.length > 0) {
        const isAvailable = opWindows.some(w => date >= w.startDate && date <= w.endDate);
        if (!isAvailable) return true;
      }
    }
    return false;
  }, [timeOffRecords, operators, availabilityRecords]);

  const handleCopyRequestorToContact = () => {
    const requestor = form.getValues("requestorContact");
    if (requestor) {
      form.setValue("onSiteContact", requestor);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (values.operatorId && values.scheduledDate && operatorOffDays.has(`${values.operatorId}-${values.scheduledDate}`)) {
      const op = operators?.find(o => o.id === values.operatorId);
      const opName = op ? formatOperatorFullName(op) : "This operator";
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
    }
  };

  const isPending = createJob.isPending || updateJob.isPending || createJobSeries.isPending;
  const currentStatusOption = STATUS_OPTIONS.find(s => s.value === watchedStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <DialogHeader className="p-0 space-y-0">
            <DialogTitle className="text-lg font-semibold">{isEditing ? "Edit Job" : "New Job"}</DialogTitle>
          </DialogHeader>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  className="w-auto gap-2 border-0 shadow-none font-medium text-sm"
                  data-testid="select-status"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: currentStatusOption?.color }}
                  />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 pb-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Customer</FormLabel>
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

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">
                        {isMultiDay ? "Start" : "Date"}
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-scheduled-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Time</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          <Input {...field} placeholder="07:00 AM" className="pl-8" data-testid="input-start-time" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {!isEditing && (
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isMultiDay}
                  onCheckedChange={(checked) => {
                    setIsMultiDay(!!checked);
                    if (!checked) setEndDate("");
                  }}
                  data-testid="checkbox-multi-day"
                />
                <label className="flex items-center gap-1.5 text-sm cursor-pointer text-muted-foreground">
                  <CalendarRange className="w-3.5 h-3.5" />
                  Multi-day job
                </label>
                {isMultiDay && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={form.watch("scheduledDate")}
                      className="w-auto"
                      data-testid="input-end-date"
                    />
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Job Site Address</FormLabel>
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

            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Scope of Work</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describe the job scope..." rows={2} className="resize-none" data-testid="input-scope" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requestorContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Requestor</FormLabel>
                    <FormControl>
                      <ContactSearchInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        customerId={form.watch("customerId")}
                        placeholder="Search or type contact..."
                        testId="input-requestor"
                      />
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
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">On-Site Contact</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={handleCopyRequestorToContact}
                        data-testid="button-copy-requestor"
                      >
                        <Copy className="w-3 h-3" />
                        Same as Requestor
                      </Button>
                    </div>
                    <FormControl>
                      <ContactSearchInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        customerId={form.watch("customerId")}
                        placeholder="Search or type contact..."
                        testId="input-onsite-contact"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="poNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">Job # / PO #</FormLabel>
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
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide">SR #</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="SR number" data-testid="input-sr-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="water"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Droplets className="w-3 h-3" />
                        Water
                      </FormLabel>
                      <div className="flex gap-0">
                        <Button
                          type="button"
                          variant={field.value === "on_site" ? "default" : "outline"}
                          size="sm"
                          className="rounded-r-none flex-1"
                          onClick={() => field.onChange(field.value === "on_site" ? "" : "on_site")}
                          data-testid="toggle-water-onsite"
                        >
                          On Site
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === "off_site" ? "default" : "outline"}
                          size="sm"
                          className="rounded-l-none flex-1 border-l-0"
                          onClick={() => field.onChange(field.value === "off_site" ? "" : "off_site")}
                          data-testid="toggle-water-offsite"
                        >
                          Off Site
                        </Button>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dump"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Truck className="w-3 h-3" />
                        Dump
                      </FormLabel>
                      <div className="flex gap-0">
                        <Button
                          type="button"
                          variant={field.value === "on_site" ? "default" : "outline"}
                          size="sm"
                          className="rounded-r-none flex-1"
                          onClick={() => field.onChange(field.value === "on_site" ? "" : "on_site")}
                          data-testid="toggle-dump-onsite"
                        >
                          On Site
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === "off_site" ? "default" : "outline"}
                          size="sm"
                          className="rounded-l-none flex-1 border-l-0"
                          onClick={() => field.onChange(field.value === "off_site" ? "" : "off_site")}
                          data-testid="toggle-dump-offsite"
                        >
                          Off Site
                        </Button>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

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
                      <FormLabel className="cursor-pointer text-sm">Remote Hose</FormLabel>
                    </FormItem>
                  )}
                />

                {watchedRemoteHose && (
                  <FormField
                    control={form.control}
                    name="remoteHoseLength"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormLabel className="whitespace-nowrap text-xs text-muted-foreground">Length:</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="200ft" className="w-20 h-8" data-testid="input-remote-hose-length" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="manifestNeeded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-manifest"
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer text-sm flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Manifest Needed
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {watchedManifestNeeded && (
                <div className="space-y-3 pl-6 border-l-2 border-amber-500/30">
                  <FormField
                    control={form.control}
                    name="manifestNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Manifest #</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            placeholder="Enter manifest number"
                            data-testid="input-manifest-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel className="text-sm">Dump Location</FormLabel>
                    {!showNewDumpLocation ? (
                      <div className="space-y-2">
                        <Select
                          value={form.watch("manifestDumpLocationName") && form.watch("manifestDumpLocation")
                            ? `${form.watch("manifestDumpLocationName")}|||${form.watch("manifestDumpLocation")}`
                            : ""}
                          onValueChange={(val) => {
                            if (val === "__new__") {
                              setShowNewDumpLocation(true);
                              setNewDumpName("");
                              setNewDumpAddress("");
                            } else if (val) {
                              const [name, address] = val.split("|||");
                              form.setValue("manifestDumpLocationName", name);
                              form.setValue("manifestDumpLocation", address);
                            } else {
                              form.setValue("manifestDumpLocationName", "");
                              form.setValue("manifestDumpLocation", "");
                            }
                          }}
                        >
                          <SelectTrigger data-testid="select-dump-location">
                            <SelectValue placeholder="Select saved location..." />
                          </SelectTrigger>
                          <SelectContent>
                            {dumpLocations?.map((loc) => (
                              <SelectItem key={loc.id} value={`${loc.name}|||${loc.address}`}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{loc.name}</span>
                                  <span className="text-xs text-muted-foreground">{loc.address}</span>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value="__new__">
                              <span className="flex items-center gap-1.5 text-primary">
                                <Plus className="w-3.5 h-3.5" />
                                Add New Location
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {form.watch("manifestDumpLocationName") && (
                          <div className="text-xs text-muted-foreground flex items-start gap-1.5 pl-1">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{form.watch("manifestDumpLocation")}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                        <Input
                          value={newDumpName}
                          onChange={(e) => setNewDumpName(e.target.value)}
                          placeholder="Location name (e.g. Orchard Ridge)"
                          data-testid="input-new-dump-name"
                        />
                        <AddressAutocomplete
                          value={newDumpAddress}
                          onChange={setNewDumpAddress}
                          onPlaceSelect={(result) => {
                            setNewDumpAddress(result.address);
                          }}
                          placeholder="Search dump address..."
                          data-testid="input-new-dump-address"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            disabled={!newDumpName.trim() || !newDumpAddress.trim() || createDumpLocation.isPending}
                            onClick={async () => {
                              await createDumpLocation.mutateAsync({
                                name: newDumpName.trim(),
                                address: newDumpAddress.trim(),
                              });
                              form.setValue("manifestDumpLocationName", newDumpName.trim());
                              form.setValue("manifestDumpLocation", newDumpAddress.trim());
                              setShowNewDumpLocation(false);
                              setNewDumpName("");
                              setNewDumpAddress("");
                            }}
                            data-testid="button-save-dump-location"
                          >
                            {createDumpLocation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            ) : (
                              <Save className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Save Location
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowNewDumpLocation(false);
                              setNewDumpName("");
                              setNewDumpAddress("");
                            }}
                            data-testid="button-cancel-dump-location"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <FormLabel className="text-sm">Scheduled Dump Times</FormLabel>
                    <div className="space-y-2 mt-1.5">
                      {(form.watch("scheduledDumpTimes") || []).map((time: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              type="time"
                              value={time}
                              onChange={(e) => {
                                const current = [...(form.getValues("scheduledDumpTimes") || [])];
                                current[idx] = e.target.value;
                                form.setValue("scheduledDumpTimes", current);
                              }}
                              className="pl-8"
                              data-testid={`input-dump-time-${idx}`}
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const current = [...(form.getValues("scheduledDumpTimes") || [])];
                              current.splice(idx, 1);
                              form.setValue("scheduledDumpTimes", current);
                            }}
                            data-testid={`button-remove-dump-time-${idx}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const current = form.getValues("scheduledDumpTimes") || [];
                          form.setValue("scheduledDumpTimes", [...current, ""]);
                        }}
                        data-testid="button-add-dump-time"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Dump Time
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-4 flex-wrap">
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
                      <FormLabel className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <Users className="w-3.5 h-3.5" />
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
                      <FormItem className="flex-1 min-w-[200px]">
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
                              .filter((op) => !operatorHasDayOff(op.id, form.watch("scheduledDate")))
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
            </div>

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

function ContactSearchInput({ value, onChange, customerId, placeholder, testId }: {
  value: string;
  onChange: (val: string) => void;
  customerId: number | undefined;
  placeholder?: string;
  testId?: string;
}) {
  const { data: contacts } = useCustomerContacts(customerId);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredContacts = useMemo(() => {
    if (!contacts || !inputValue.trim()) return contacts || [];
    const search = inputValue.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        (c.phone && c.phone.toLowerCase().includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search)) ||
        (c.role && c.role.toLowerCase().includes(search))
    );
  }, [contacts, inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
    setShowDropdown(true);
  };

  const handleSelectContact = useCallback((contact: CustomerContact) => {
    const formatted = contact.phone
      ? `${contact.name} (${contact.phone})`
      : contact.name;
    setInputValue(formatted);
    onChange(formatted);
    setShowDropdown(false);
  }, [onChange]);

  const handleFocus = () => {
    if (contacts && contacts.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setShowDropdown(false), 200);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="pl-8"
          data-testid={testId}
        />
      </div>
      {showDropdown && contacts && contacts.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
          {(filteredContacts.length > 0 ? filteredContacts : contacts).map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover-elevate"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectContact(contact);
              }}
              data-testid={`contact-option-${contact.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{contact.name}</span>
                  {contact.role && (
                    <Badge variant="secondary" className="text-[10px]">{contact.role}</Badge>
                  )}
                </div>
                {contact.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Phone className="w-3 h-3" />
                    {contact.phone}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
