import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type CustomerContact, type InsertCustomerContact } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useCustomerContacts(customerId: number | undefined) {
  return useQuery<CustomerContact[]>({
    queryKey: ["/api/customers", customerId, "contacts"],
    queryFn: async () => {
      if (!customerId) return [];
      const res = await fetch(`/api/customers/${customerId}/contacts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!customerId,
  });
}

export function useCreateCustomerContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertCustomerContact) => {
      const res = await fetch(`/api/customers/${data.customerId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create contact");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "contacts"] });
      toast({ title: "Contact added" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateCustomerContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, customerId, ...data }: Partial<InsertCustomerContact> & { id: number; customerId: number }) => {
      const res = await fetch(`/api/customer-contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, customerId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update contact");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "contacts"] });
      toast({ title: "Contact updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteCustomerContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, customerId }: { id: number; customerId: number }) => {
      const res = await fetch(`/api/customer-contacts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete contact");
      return customerId;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "contacts"] });
      toast({ title: "Contact deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
