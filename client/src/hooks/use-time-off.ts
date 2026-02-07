import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { OperatorTimeOff, Operator } from "@shared/schema";

interface TimeOffFilters {
  startDate?: string;
  endDate?: string;
  operatorId?: number;
}

export type TimeOffWithOperator = OperatorTimeOff & { operator?: Operator };

export function useTimeOff(filters?: TimeOffFilters) {
  return useQuery<TimeOffWithOperator[]>({
    queryKey: ["/api/time-off", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      if (filters?.operatorId) params.append("operatorId", String(filters.operatorId));
      const url = `/api/time-off${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch time off");
      return res.json();
    },
  });
}

export function useCreateTimeOff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { operatorId: number; startDate: string; endDate: string; reason?: string | null }) => {
      const res = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create time off");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off"], exact: false });
      toast({ title: "Time Off Added", description: "Operator marked as off" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteTimeOff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/time-off/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete time off");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off"], exact: false });
      toast({ title: "Time Off Removed", description: "Operator is back on the schedule" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useRemoveTimeOffDay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, date }: { id: number; date: string }) => {
      const res = await fetch(`/api/time-off/${id}/remove-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove day");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off"], exact: false });
      toast({ title: "Day Removed", description: "Time off day has been removed" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
