import { useCustomers, useCreateCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Users, Pencil, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { QualificationMultiSelect } from "@/pages/Operators";

export default function Customers() {
  const { data: customers, isLoading } = useCustomers();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage client base and required certifications</p>
        </div>
        <Button onClick={() => { setEditingCustomer(null); setIsOpen(true); }} data-testid="button-add-customer">
          <Plus className="w-4 h-4 mr-2" />
          New Customer
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers?.map((customer) => (
            <Card key={customer.id} className="group hover:shadow-md transition-shadow" data-testid={`card-customer-${customer.id}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg font-bold">{customer.name}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setEditingCustomer(customer); setIsOpen(true); }}
                  data-testid={`button-edit-customer-${customer.id}`}
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mt-2">
                  <span className="font-semibold text-foreground">Contact: </span>
                  {customer.contactInfo || "N/A"}
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Required Certifications
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {customer.requiredQuals && customer.requiredQuals.length > 0 ? (
                      customer.requiredQuals.map((q, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-primary/30 text-primary" data-testid={`badge-req-qual-${customer.id}-${i}`}>
                          {q}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No certifications required</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CustomerDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        initialData={editingCustomer}
      />
    </div>
  );
}

function CustomerDialog({ open, onOpenChange, initialData }: { open: boolean; onOpenChange: (v: boolean) => void; initialData: any }) {
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const isEditing = !!initialData;
  const isPending = createCustomer.isPending || updateCustomer.isPending;
  const [selectedQuals, setSelectedQuals] = useState<string[]>([]);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && initialData?.requiredQuals) {
      setSelectedQuals(initialData.requiredQuals);
    } else if (isOpen) {
      setSelectedQuals([]);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      contactInfo: formData.get("contactInfo") as string,
      requiredQuals: selectedQuals,
    };

    try {
      if (isEditing) {
        await updateCustomer.mutateAsync({ id: initialData.id, ...data });
      } else {
        await createCustomer.mutateAsync(data);
      }
      onOpenChange(false);
    } catch (err) {}
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name</Label>
            <Input id="name" name="name" defaultValue={initialData?.name} required data-testid="input-customer-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactInfo">Contact Information</Label>
            <Input id="contactInfo" name="contactInfo" defaultValue={initialData?.contactInfo} placeholder="Email or Phone" data-testid="input-customer-contact" />
          </div>
          <div className="space-y-2">
            <Label>Required Certifications / OQs</Label>
            <p className="text-xs text-muted-foreground">Operators must have these certifications to be scheduled for this customer's jobs</p>
            <QualificationMultiSelect
              selected={selectedQuals}
              onChange={setSelectedQuals}
              testId="button-customer-quals"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending} data-testid="button-save-customer">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
