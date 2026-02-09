import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DumpLocation, InsertDumpLocation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useDumpLocations() {
  return useQuery<DumpLocation[]>({
    queryKey: ["/api/dump-locations"],
  });
}

export function useCreateDumpLocation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDumpLocation) => {
      const res = await fetch("/api/dump-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create dump location");
      return res.json() as Promise<DumpLocation>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dump-locations"] });
      toast({ title: "Saved", description: "Dump location saved for future use" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteDumpLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/dump-locations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete dump location");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dump-locations"] });
    },
  });
}
