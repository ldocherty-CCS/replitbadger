import { useCustomers, useCreateCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { useCustomerContacts, useCreateCustomerContact, useUpdateCustomerContact, useDeleteCustomerContact } from "@/hooks/use-customer-contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Users, Pencil, ShieldCheck, Phone, Mail, UserCircle, Trash2, Contact } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { QualificationMultiSelect } from "@/pages/Operators";
import type { CustomerContact } from "@shared/schema";

export default function Customers() {
  const { data: customers, isLoading } = useCustomers();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [contactsCustomerId, setContactsCustomerId] = useState<number | null>(null);

  const contactsCustomer = customers?.find(c => c.id === contactsCustomerId);

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
                <div className="mt-3 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setContactsCustomerId(customer.id)}
                    data-testid={`button-contacts-${customer.id}`}
                  >
                    <Contact className="w-3.5 h-3.5 mr-1.5" />
                    Manage Contacts
                  </Button>
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

      <ContactsDialog
        open={!!contactsCustomerId}
        onOpenChange={(v) => { if (!v) setContactsCustomerId(null); }}
        customerId={contactsCustomerId}
        customerName={contactsCustomer?.name || ""}
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

function ContactsDialog({ open, onOpenChange, customerId, customerName }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: number | null;
  customerName: string;
}) {
  const { data: contacts, isLoading } = useCustomerContacts(customerId ?? undefined);
  const createContact = useCreateCustomerContact();
  const updateContact = useUpdateCustomerContact();
  const deleteContact = useDeleteCustomerContact();
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customerId) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("contactName") as string,
      phone: (formData.get("contactPhone") as string) || null,
      email: (formData.get("contactEmail") as string) || null,
      role: (formData.get("contactRole") as string) || null,
    };

    try {
      if (editingContact) {
        await updateContact.mutateAsync({ id: editingContact.id, ...data, customerId });
      } else {
        await createContact.mutateAsync({ ...data, customerId });
      }
      setShowForm(false);
      setEditingContact(null);
    } catch (err) {}
  };

  const handleEdit = (contact: CustomerContact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!customerId) return;
    try {
      await deleteContact.mutateAsync({ id, customerId });
    } catch (err) {}
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setShowForm(false);
      setEditingContact(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Contact className="w-5 h-5" />
            Contacts for {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : contacts && contacts.length > 0 ? (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border"
                  data-testid={`contact-row-${contact.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" data-testid={`text-contact-name-${contact.id}`}>{contact.name}</span>
                      {contact.role && (
                        <Badge variant="secondary" className="text-[10px]">{contact.role}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(contact)}
                      data-testid={`button-edit-contact-${contact.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(contact.id)}
                      data-testid={`button-delete-contact-${contact.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm" data-testid="text-no-contacts">
              <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              No contacts yet
            </div>
          )}

          {showForm ? (
            <form onSubmit={handleFormSubmit} className="space-y-3 p-4 rounded-md border bg-muted/30" data-testid="form-contact">
              <div className="text-sm font-medium">{editingContact ? "Edit Contact" : "New Contact"}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    name="contactName"
                    defaultValue={editingContact?.name || ""}
                    required
                    placeholder="Full name"
                    data-testid="input-contact-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    name="contactPhone"
                    defaultValue={editingContact?.phone || ""}
                    placeholder="555-0123"
                    data-testid="input-contact-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    name="contactEmail"
                    defaultValue={editingContact?.email || ""}
                    placeholder="email@example.com"
                    data-testid="input-contact-email"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Role</Label>
                  <Input
                    name="contactRole"
                    defaultValue={editingContact?.role || ""}
                    placeholder="e.g. Requestor, On-Site Contact, PM"
                    data-testid="input-contact-role"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingContact(null); }} data-testid="button-cancel-contact">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createContact.isPending || updateContact.isPending}
                  data-testid="button-save-contact"
                >
                  {(createContact.isPending || updateContact.isPending) && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {editingContact ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setEditingContact(null); setShowForm(true); }}
              data-testid="button-add-contact"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
