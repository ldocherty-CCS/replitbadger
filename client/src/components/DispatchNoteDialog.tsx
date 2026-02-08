import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateJob, useUpdateJob } from "@/hooks/use-jobs";
import { useOperators } from "@/hooks/use-operators";
import type { Job } from "@shared/schema";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { format, parseISO } from "date-fns";
import { formatOperatorFullName } from "@/lib/utils";

const noteSchema = z.object({
  scope: z.string().min(1, "Note is required"),
});

type NoteValues = z.infer<typeof noteSchema>;

interface DispatchNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  operatorId: number;
  editJob?: Job;
}

export function DispatchNoteDialog({ open, onOpenChange, date, operatorId, editJob }: DispatchNoteDialogProps) {
  const { data: operators } = useOperators();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const operator = operators?.find(op => op.id === (editJob?.operatorId || operatorId));
  const isEditing = !!editJob;

  const form = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { scope: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ scope: editJob?.scope || "" });
    }
  }, [open, form, editJob]);

  const onSubmit = async (values: NoteValues) => {
    if (isEditing) {
      await updateJob.mutateAsync({ id: editJob.id, scope: values.scope });
    } else {
      await createJob.mutateAsync({
        customerId: null,
        operatorId,
        scope: values.scope,
        startTime: "08:00 AM",
        scheduledDate: date,
        address: "",
        status: "dispatched",
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-dispatch-note">
        <DialogHeader>
          <DialogTitle data-testid="text-dispatch-note-title">
            {isEditing ? "Edit Dispatch Note" : "Add Dispatch Note"}
          </DialogTitle>
          {operator && date && (
            <p className="text-sm text-muted-foreground mt-1">
              {formatOperatorFullName(operator)} — {date ? format(parseISO(date), "EEE, MMM d") : ""}
            </p>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note / Task</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Sweep the shop, maintenance day, training..."
                      className="resize-none"
                      rows={3}
                      data-testid="input-dispatch-note"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-note">
                Cancel
              </Button>
              <Button type="submit" disabled={createJob.isPending || updateJob.isPending} data-testid="button-save-note">
                {(createJob.isPending || updateJob.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Update Note" : "Save Note"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
