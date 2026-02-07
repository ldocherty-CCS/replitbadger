import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertQualification } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useQualifications() {
  return useQuery({
    queryKey: [api.qualifications.list.path],
    queryFn: async () => {
      const res = await fetch(api.qualifications.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch qualifications");
      return res.json();
    },
  });
}

export function useCreateQualification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertQualification) => {
      const res = await fetch(api.qualifications.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create qualification");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.qualifications.list.path] });
      toast({ title: "Success", description: "Qualification added" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
