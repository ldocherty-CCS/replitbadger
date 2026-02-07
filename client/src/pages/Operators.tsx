import { useOperators, useCreateOperator, useDeleteOperator, useUpdateOperator } from "@/hooks/use-operators";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Operators() {
  const { data: operators, isLoading } = useOperators();
  const deleteOp = useDeleteOperator();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<any>(null);

  const filteredOperators = operators?.filter(op => 
    op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.groupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Operators</h1>
          <p className="text-muted-foreground mt-1">Manage drivers, trucks, and qualifications</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search operators..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => { setEditingOp(null); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Operator
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOperators?.map((op) => (
            <Card key={op.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: op.color || '#3b82f6' }}
                  >
                    {op.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">{op.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{op.groupName}</p>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingOp(op); setIsDialogOpen(true); }}>
                    <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm("Are you sure? This cannot be undone.")) {
                      deleteOp.mutate(op.id);
                    }
                  }}>
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Phone:</div>
                    <div className="font-medium text-right">{op.phone || "N/A"}</div>
                    
                    <div className="text-muted-foreground">Location:</div>
                    <div className="font-medium text-right truncate">{op.truckLocation || "N/A"}</div>
                  </div>

                  <div className="pt-2">
                    <div className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Qualifications</div>
                    <div className="flex flex-wrap gap-1.5">
                      {op.qualifications?.length ? (
                        op.qualifications.map((q, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                            {q}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No qualifications listed</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OperatorDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        initialData={editingOp} 
      />
    </div>
  );
}

function OperatorDialog({ open, onOpenChange, initialData }: any) {
  const createOp = useCreateOperator();
  const updateOp = useUpdateOperator();
  const isEditing = !!initialData;
  const isPending = createOp.isPending || updateOp.isPending;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      groupName: formData.get("groupName") as string,
      phone: formData.get("phone") as string,
      truckLocation: formData.get("truckLocation") as string,
      color: formData.get("color") as string,
      qualifications: (formData.get("qualifications") as string).split(",").map(s => s.trim()).filter(Boolean),
    };

    try {
      if (isEditing) {
        await updateOp.mutateAsync({ id: initialData.id, ...data });
      } else {
        await createOp.mutateAsync(data);
      }
      onOpenChange(false);
    } catch (err) {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Operator" : "Add Operator"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" defaultValue={initialData?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group / Region</Label>
              <Input id="groupName" name="groupName" defaultValue={initialData?.groupName} required placeholder="e.g. Milwaukee" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color Identifier</Label>
              <div className="flex gap-2">
                <Input type="color" id="color" name="color" className="w-12 p-1" defaultValue={initialData?.color || "#3b82f6"} />
                <Input type="text" value={initialData?.color} disabled className="flex-1 opacity-50" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" name="phone" defaultValue={initialData?.phone} placeholder="(555) 123-4567" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="truckLocation">Truck Park Location</Label>
            <Input id="truckLocation" name="truckLocation" defaultValue={initialData?.truckLocation} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qualifications">Qualifications (comma separated)</Label>
            <Input id="qualifications" name="qualifications" defaultValue={initialData?.qualifications?.join(", ")} placeholder="OSHA 10, Confined Space, CDL A" />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Operator"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
