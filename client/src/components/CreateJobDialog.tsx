import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertJobSchema, type Job } from "@shared/schema";
import { useCreateJob, useUpdateJob } from "@/hooks/use-jobs";
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
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

// Extend schema to handle string conversion for IDs
const formSchema = insertJobSchema.extend({
  customerId: z.coerce.number(),
  operatorId: z.coerce.number().optional().nullable(),
  additionalOperatorNeeded: z.boolean().default(false),
  manifestNeeded: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Job | null;
  defaultDate?: string;
}

export function CreateJobDialog({ 
  open, 
  onOpenChange, 
  initialData, 
  defaultDate 
}: CreateJobDialogProps) {
  const { data: customers } = useCustomers();
  const { data: operators } = useOperators();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();

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
        scheduledDate: initialData.scheduledDate,
      });
    } else if (defaultDate) {
      form.reset({
        ...form.getValues(),
        scheduledDate: defaultDate,
      });
    }
  }, [initialData, defaultDate, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && initialData) {
        await updateJob.mutateAsync({ id: initialData.id, ...values });
      } else {
        await createJob.mutateAsync(values);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // handled by mutation hook
    }
  };

  const isPending = createJob.isPending || updateJob.isPending;

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
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        {operators?.map((op) => (
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
