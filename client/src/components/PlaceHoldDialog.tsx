import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateJob } from "@/hooks/use-jobs";
import { useCustomers } from "@/hooks/use-customers";
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
import { useToast } from "@/hooks/use-toast";

const holdSchema = z.object({
  customerId: z.coerce.number().min(1, "Please select a customer"),
  notes: z.string().optional(),
});

type HoldFormValues = z.infer<typeof holdSchema>;

interface PlaceHoldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  operatorId: number;
}

export function PlaceHoldDialog({
  open,
  onOpenChange,
  date,
  operatorId,
}: PlaceHoldDialogProps) {
  const { data: customers } = useCustomers();
  const createJob = useCreateJob();
  const { toast } = useToast();

  const form = useForm<HoldFormValues>({
    resolver: zodResolver(holdSchema),
    defaultValues: {
      customerId: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ customerId: 0, notes: "" });
    }
  }, [open, form]);

  const onSubmit = async (values: HoldFormValues) => {
    try {
      await createJob.mutateAsync({
        customerId: values.customerId,
        operatorId,
        scope: values.notes || "HOLD",
        startTime: "TBD",
        scheduledDate: date,
        address: "TBD",
        status: "missing_info",
      });
      toast({ title: "Hold Placed", description: "A hold has been placed on the schedule" });
      onOpenChange(false);
    } catch (error) {
      // handled by mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle data-testid="text-hold-dialog-title">Place Hold</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ? field.value.toString() : undefined}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-hold-customer">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()} data-testid={`select-hold-customer-${c.id}`}>
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Any notes about this hold..."
                      className="resize-none"
                      rows={2}
                      data-testid="input-hold-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-hold-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createJob.isPending} data-testid="button-hold-submit">
                {createJob.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Place Hold
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
