import { useOperators, useCreateOperator, useDeleteOperator, useUpdateOperator } from "@/hooks/use-operators";
import { useQualifications, useCreateQualification } from "@/hooks/use-qualifications";
import { useOperatorAvailability, useCreateOperatorAvailability, useUpdateOperatorAvailability, useDeleteOperatorAvailability } from "@/hooks/use-operator-availability";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { Loader2, Plus, Pencil, Trash2, Search, X, Check, ChevronsUpDown, MapPinOff, Calendar, Clock, Upload, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn, formatOperatorFullName } from "@/lib/utils";
import { getOperatorColor, getOperatorTypeLabel } from "@/lib/operator-colors";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { format, parseISO, isPast, isWithinInterval, isFuture } from "date-fns";
import { useUpload } from "@/hooks/use-upload";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { OperatorAvailability } from "@shared/schema";

export default function Operators() {
  const { data: operators, isLoading } = useOperators();
  const deleteOp = useDeleteOperator();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<any>(null);
  const [availabilityOp, setAvailabilityOp] = useState<any>(null);
  const [documentsOp, setDocumentsOp] = useState<any>(null);

  const filteredOperators = operators?.filter(op => 
    op.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatOperatorFullName(op).toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.groupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedOperators = useMemo(() => {
    if (!filteredOperators) return {};
    const groups: Record<string, typeof filteredOperators> = {};
    filteredOperators.forEach(op => {
      const group = op.groupName || "Ungrouped";
      if (!groups[group]) groups[group] = [];
      groups[group].push(op);
    });
    Object.values(groups).forEach(ops => {
      ops.sort((a, b) => {
        if (a.operatorType === "assistant" && b.operatorType !== "assistant") return 1;
        if (a.operatorType !== "assistant" && b.operatorType === "assistant") return -1;
        const lastNameCmp = a.lastName.localeCompare(b.lastName);
        if (lastNameCmp !== 0) return lastNameCmp;
        return a.firstName.localeCompare(b.firstName);
      });
    });
    return groups;
  }, [filteredOperators]);

  const sortedGroupNames = Object.keys(groupedOperators).sort();

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
              data-testid="input-search-operators"
            />
          </div>
          <Button onClick={() => { setEditingOp(null); setIsDialogOpen(true); }} data-testid="button-add-operator">
            <Plus className="w-4 h-4 mr-2" />
            Add Operator
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : sortedGroupNames.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No operators found</div>
      ) : (
        <div className="space-y-8">
          {sortedGroupNames.map(groupName => (
            <div key={groupName} data-testid={`group-${groupName}`}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-foreground">{groupName}</h2>
                <Badge variant="secondary">{groupedOperators[groupName].length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedOperators[groupName].map((op) => (
                  <Card key={op.id} className="group hover:shadow-md transition-shadow" data-testid={`card-operator-${op.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 pb-2">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                          style={{ backgroundColor: getOperatorColor(op) }}
                        >
                          {(op.firstName.charAt(0) + op.lastName.charAt(0)).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg font-bold">{formatOperatorFullName(op)}</CardTitle>
                            {op.isOutOfState && (
                              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400">OOS</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{op.groupName} &middot; {getOperatorTypeLabel(op.operatorType)}</p>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDocumentsOp(op)} data-testid={`button-documents-${op.id}`}>
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingOp(op); setIsDialogOpen(true); }} data-testid={`button-edit-operator-${op.id}`}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm("Are you sure? This cannot be undone.")) {
                            deleteOp.mutate(op.id);
                          }
                        }} data-testid={`button-delete-operator-${op.id}`}>
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 mt-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-muted-foreground">Phone:</div>
                          <div className="font-medium text-right">{op.phone || "N/A"}</div>
                          
                          <div className="text-muted-foreground">Location:</div>
                          <div className="font-medium text-right truncate">
                            {op.isOutOfState ? "Near prev. job" : (op.truckLocation || "N/A")}
                          </div>
                          {op.isOutOfState && (
                            <>
                              <div className="text-muted-foreground">Availability:</div>
                              <div className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setAvailabilityOp(op)}
                                  data-testid={`button-availability-${op.id}`}
                                >
                                  <Calendar className="w-3 h-3" />
                                  Manage
                                </Button>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="pt-2">
                          <div className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Certifications / OQs</div>
                          <div className="flex flex-wrap gap-1.5">
                            {op.qualifications?.length ? (
                              op.qualifications.map((q, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5" data-testid={`badge-qual-${op.id}-${i}`}>
                                  {q}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No certifications listed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <OperatorDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        initialData={editingOp}
        operators={operators || []}
      />

      {availabilityOp && (
        <AvailabilityDialog
          open={!!availabilityOp}
          onOpenChange={(open) => { if (!open) setAvailabilityOp(null); }}
          operator={availabilityOp}
        />
      )}

      <DocumentsDialog
        open={!!documentsOp}
        onOpenChange={(o) => { if (!o) setDocumentsOp(null); }}
        operator={documentsOp || {}}
      />
    </div>
  );
}

function QualificationMultiSelect({
  selected,
  onChange,
  testId,
}: {
  selected: string[];
  onChange: (vals: string[]) => void;
  testId?: string;
}) {
  const { data: qualifications } = useQualifications();
  const createQual = useCreateQualification();
  const [open, setOpen] = useState(false);
  const [newQualName, setNewQualName] = useState("");

  const allQuals: string[] = qualifications?.map((q: any) => q.name) || [];

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((s) => s !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const handleAddNew = async () => {
    const trimmed = newQualName.trim();
    if (!trimmed) return;
    if (!allQuals.includes(trimmed)) {
      await createQual.mutateAsync({ name: trimmed });
    }
    if (!selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setNewQualName("");
  };

  const grouped: Record<string, string[]> = {};
  qualifications?.forEach((q: any) => {
    const cat = q.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(q.name);
  });

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            data-testid={testId || "button-select-quals"}
          >
            {selected.length > 0 ? `${selected.length} selected` : "Select certifications..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search certifications..." />
            <CommandList>
              <CommandEmpty>
                <div className="p-2 text-sm text-muted-foreground">No match found</div>
              </CommandEmpty>
              {Object.entries(grouped).map(([category, quals]) => (
                <CommandGroup key={category} heading={category}>
                  {quals.map((name) => (
                    <CommandItem
                      key={name}
                      value={name}
                      onSelect={() => toggle(name)}
                      data-testid={`option-qual-${name}`}
                    >
                      <div className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selected.includes(name) ? "bg-primary text-primary-foreground" : "opacity-50"
                      )}>
                        {selected.includes(name) && <Check className="h-3 w-3" />}
                      </div>
                      {name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
            <div className="border-t p-2 flex gap-2">
              <Input
                placeholder="Add new certification..."
                value={newQualName}
                onChange={(e) => setNewQualName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNew(); } }}
                className="flex-1"
                data-testid="input-new-qual"
              />
              <Button size="sm" onClick={handleAddNew} disabled={!newQualName.trim() || createQual.isPending} data-testid="button-add-qual">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <Badge key={name} variant="secondary" className="gap-1">
              {name}
              <button onClick={() => toggle(name)} className="ml-0.5 rounded-full">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function OperatorDialog({ open, onOpenChange, initialData, operators }: any) {
  const createOp = useCreateOperator();
  const updateOp = useUpdateOperator();
  const isEditing = !!initialData;
  const isPending = createOp.isPending || updateOp.isPending;
  const [selectedQuals, setSelectedQuals] = useState<string[]>([]);
  const [isOutOfState, setIsOutOfState] = useState(false);
  const [operatorType, setOperatorType] = useState<string>("operator");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableTo, setAvailableTo] = useState("");
  const [truckLocation, setTruckLocation] = useState("");
  const [truckLat, setTruckLat] = useState<string>("");
  const [truckLng, setTruckLng] = useState<string>("");
  const [groupName, setGroupName] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);

  const existingGroups: string[] = [...new Set((operators || []).map((op: any) => op.groupName).filter(Boolean))].sort();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && initialData) {
      setSelectedQuals(initialData.qualifications || []);
      setIsOutOfState(initialData.isOutOfState || false);
      setOperatorType(initialData.operatorType || "operator");
      setAvailableFrom(initialData.availableFrom || "");
      setAvailableTo(initialData.availableTo || "");
      setTruckLocation(initialData.truckLocation || "");
      setTruckLat(initialData.truckLat ? String(initialData.truckLat) : "");
      setTruckLng(initialData.truckLng ? String(initialData.truckLng) : "");
      setGroupName(initialData.groupName || "");
    } else if (isOpen) {
      setSelectedQuals([]);
      setIsOutOfState(false);
      setOperatorType("operator");
      setAvailableFrom("");
      setAvailableTo("");
      setTruckLocation("");
      setTruckLat("");
      setTruckLng("");
      setGroupName("");
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      groupName: groupName.trim(),
      phone: formData.get("phone") as string,
      truckLocation: truckLocation,
      truckLat: truckLat ? parseFloat(truckLat) : null,
      truckLng: truckLng ? parseFloat(truckLng) : null,
      operatorType,
      qualifications: selectedQuals,
      isOutOfState,
      availableFrom: isOutOfState && availableFrom ? availableFrom : null,
      availableTo: isOutOfState && availableTo ? availableTo : null,
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
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Operator" : "Add Operator"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" defaultValue={initialData?.firstName} required data-testid="input-operator-first-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" name="lastName" defaultValue={initialData?.lastName} required data-testid="input-operator-last-name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group / Region</Label>
              <Popover open={groupOpen} onOpenChange={setGroupOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={groupOpen} className="w-full justify-between font-normal" data-testid="input-operator-group">
                    {groupName || "Select or type a group..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search or type new group..." value={groupName} onValueChange={setGroupName} data-testid="input-group-search" />
                    <CommandList>
                      <CommandEmpty>
                        {groupName ? (
                          <button type="button" className="w-full px-2 py-1.5 text-sm text-left" onClick={() => { setGroupOpen(false); }}>
                            Use "{groupName}"
                          </button>
                        ) : "Type a group name..."}
                      </CommandEmpty>
                      <CommandGroup>
                        {existingGroups.filter(g => g.toLowerCase().includes(groupName.toLowerCase())).map(group => (
                          <CommandItem key={group} value={group} onSelect={() => { setGroupName(group); setGroupOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", groupName === group ? "opacity-100" : "opacity-0")} />
                            {group}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={operatorType} onValueChange={setOperatorType}>
                <SelectTrigger data-testid="select-operator-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="assistant">Assistant Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" name="phone" defaultValue={initialData?.phone} placeholder="(555) 123-4567" data-testid="input-operator-phone" />
          </div>
          {operatorType !== "assistant" && (
            <div className="space-y-2">
              <Label htmlFor="truckLocation">Truck Park Location</Label>
              <AddressAutocomplete
                id="truckLocation"
                value={truckLocation}
                onChange={setTruckLocation}
                onPlaceSelect={(result) => {
                  setTruckLocation(result.address);
                  setTruckLat(String(result.lat));
                  setTruckLng(String(result.lng));
                }}
                placeholder="Search for truck parking address..."
                data-testid="input-operator-truck"
              />
            </div>
          )}
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="isOutOfState"
                checked={isOutOfState}
                onCheckedChange={(v) => setIsOutOfState(v === true)}
                data-testid="checkbox-out-of-state"
              />
              <div className="space-y-0.5">
                <Label htmlFor="isOutOfState" className="font-medium cursor-pointer">Out of State</Label>
                <p className="text-xs text-muted-foreground">Truck location will be assumed near the previous day's job site</p>
              </div>
            </div>
            {isOutOfState && (
              <div className="pl-7">
                <p className="text-xs text-muted-foreground">After creating this operator, use the "Manage" button on their card to set availability windows.</p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Certifications / OQs</Label>
            <QualificationMultiSelect
              selected={selectedQuals}
              onChange={setSelectedQuals}
              testId="button-operator-quals"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending} data-testid="button-save-operator">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Operator"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AvailabilityDialog({ open, onOpenChange, operator }: { open: boolean; onOpenChange: (open: boolean) => void; operator: any }) {
  const { data: records, isLoading } = useOperatorAvailability(operator.id);
  const createAvail = useCreateOperatorAvailability();
  const updateAvail = useUpdateOperatorAvailability();
  const deleteAvail = useDeleteOperatorAvailability();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setStartDate("");
    setEndDate("");
    setNotes("");
  };

  const handleEdit = (record: OperatorAvailability) => {
    setEditingId(record.id);
    setStartDate(record.startDate);
    setEndDate(record.endDate);
    setNotes(record.notes || "");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    try {
      if (editingId) {
        await updateAvail.mutateAsync({ id: editingId, startDate, endDate, notes: notes || null });
      } else {
        await createAvail.mutateAsync({ operatorId: operator.id, startDate, endDate, notes: notes || null });
      }
      resetForm();
    } catch {}
  };

  const getStatus = (record: OperatorAvailability) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = parseISO(record.startDate);
    const end = parseISO(record.endDate);
    if (today >= start && today <= end) return "active";
    if (end < today) return "past";
    return "upcoming";
  };

  const sortedRecords = [...(records || [])].sort((a, b) => {
    const statusOrder = { active: 0, upcoming: 1, past: 2 };
    const sa = statusOrder[getStatus(a)];
    const sb = statusOrder[getStatus(b)];
    if (sa !== sb) return sa - sb;
    return b.startDate > a.startDate ? 1 : -1;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style={{ backgroundColor: getOperatorColor(operator) }}
            >
              {(operator.firstName.charAt(0) + operator.lastName.charAt(0)).toUpperCase()}
            </div>
            {formatOperatorFullName(operator)} — Availability
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sortedRecords.length === 0 && !showForm ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No availability windows set yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {sortedRecords.map((record) => {
                const status = getStatus(record);
                return (
                  <div
                    key={record.id}
                    className={cn(
                      "flex items-center justify-between gap-2 p-3 rounded-md border",
                      status === "active" && "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
                      status === "past" && "opacity-60",
                      status === "upcoming" && "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                    )}
                    data-testid={`availability-record-${record.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {format(parseISO(record.startDate), "MMM d, yyyy")} — {format(parseISO(record.endDate), "MMM d, yyyy")}
                        </span>
                        <Badge
                          variant={status === "active" ? "default" : "secondary"}
                          className={cn(
                            "text-[10px]",
                            status === "active" && "bg-green-600 hover:bg-green-700"
                          )}
                        >
                          {status === "active" ? "Current" : status === "upcoming" ? "Upcoming" : "Past"}
                        </Badge>
                      </div>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{record.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} data-testid={`button-edit-avail-${record.id}`}>
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Remove this availability window?")) {
                            deleteAvail.mutate(record.id);
                          }
                        }}
                        data-testid={`button-delete-avail-${record.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Arriving</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    data-testid="input-avail-start"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Departing</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                    required
                    data-testid="input-avail-end"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Coming from Texas crew"
                  data-testid="input-avail-notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetForm} data-testid="button-cancel-avail">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createAvail.isPending || updateAvail.isPending} data-testid="button-save-avail">
                  {(createAvail.isPending || updateAvail.isPending) && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {editingId ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowForm(true)}
              data-testid="button-add-availability"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Availability Window
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsDialog({ open, onOpenChange, operator }: { open: boolean; onOpenChange: (open: boolean) => void; operator: any }) {
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadingContentType, setUploadingContentType] = useState("");
  const [uploadingSize, setUploadingSize] = useState(0);

  const { data: documents, isLoading } = useQuery<any[]>({
    queryKey: ['/api/operators', operator.id, 'documents'],
    queryFn: async () => {
      const res = await fetch(`/api/operators/${operator.id}/documents`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
    enabled: open && !!operator?.id,
  });

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: async (response) => {
      await apiRequest("POST", `/api/operators/${operator.id}/documents`, {
        name: uploadingFileName,
        objectPath: response.objectPath,
        contentType: uploadingContentType,
        size: uploadingSize,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/operators', operator.id, 'documents'] });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingFileName(file.name);
      setUploadingContentType(file.type);
      setUploadingSize(file.size);
      await uploadFile(file);
    }
  };

  const handleDelete = async (docId: number) => {
    await apiRequest("DELETE", `/api/operator-documents/${docId}`);
    queryClient.invalidateQueries({ queryKey: ['/api/operators', operator.id, 'documents'] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Documents - {formatOperatorFullName(operator)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input type="file" id="doc-upload" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
            <Button variant="outline" onClick={() => document.getElementById('doc-upload')?.click()} disabled={isUploading} data-testid="button-upload-document">
              {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {isUploading ? `Uploading... ${progress}%` : "Upload Document"}
            </Button>
          </div>

          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
            documents?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {documents?.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 p-2 border rounded-md" data-testid={`doc-row-${doc.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <a href={doc.objectPath} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">
                          {doc.name}
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : ''}
                          {doc.createdAt ? ` · ${format(new Date(doc.createdAt), 'MMM d, yyyy')}` : ''}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)} data-testid={`button-delete-doc-${doc.id}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { QualificationMultiSelect };
