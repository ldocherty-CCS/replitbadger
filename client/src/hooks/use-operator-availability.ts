import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { OperatorAvailability, Operator } from "@shared/schema";

export type AvailabilityWithOperator = OperatorAvailability & { operator?: Operator };

export function useOperatorAvailability(operatorId?: number) {
  const url = operatorId
    ? `/api/operator-availability?operatorId=${operatorId}`
    : "/api/operator-availability";

  return useQuery<AvailabilityWithOperator[]>({
    queryKey: ["/api/operator-availability", operatorId ?? "all"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useAllOperatorAvailability() {
  return useQuery<AvailabilityWithOperator[]>({
    queryKey: ["/api/operator-availability"],
  });
}

export function useCreateOperatorAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { operatorId: number; startDate: string; endDate: string; notes?: string | null }) => {
      const res = await apiRequest("POST", "/api/operator-availability", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-availability"] });
      toast({ title: "Success", description: "Availability window added" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateOperatorAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; startDate?: string; endDate?: string; notes?: string | null }) => {
      const res = await apiRequest("PUT", `/api/operator-availability/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-availability"] });
      toast({ title: "Success", description: "Availability updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteOperatorAvailability() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/operator-availability/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-availability"] });
      toast({ title: "Success", description: "Availability record removed" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
