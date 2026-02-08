import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertOperator, type UpdateOperatorRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useOperators() {
  return useQuery({
    queryKey: [api.operators.list.path],
    queryFn: async () => {
      const res = await fetch(api.operators.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch operators");
      return api.operators.list.responses[200].parse(await res.json());
    },
  });
}

export function useOperator(id: number) {
  return useQuery({
    queryKey: [api.operators.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.operators.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch operator");
      return api.operators.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateOperator() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertOperator) => {
      const res = await fetch(api.operators.create.path, {
        method: api.operators.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.operators.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create operator");
      }
      return api.operators.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.operators.list.path] });
      toast({ title: "Success", description: "Operator created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateOperator() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateOperatorRequest) => {
      const url = buildUrl(api.operators.update.path, { id });
      const res = await fetch(url, {
        method: api.operators.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Operator not found");
        throw new Error("Failed to update operator");
      }
      return api.operators.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.operators.list.path] });
      toast({ title: "Success", description: "Operator updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteOperator() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.operators.delete.path, { id });
      const res = await fetch(url, {
        method: api.operators.delete.method,
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || (res.status === 404 ? "Operator not found" : "Failed to delete operator"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.operators.list.path] });
      toast({ title: "Success", description: "Operator deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
