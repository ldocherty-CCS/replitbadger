import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { getOperatorColor } from "@/lib/operator-colors";
import { format, differenceInDays, parseISO } from "date-fns";
import type { Operator, Qualification, OperatorQualificationWithDetails } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, AlertTriangle, CheckCircle2, Clock, XCircle, Search, FileText, Pencil, Trash2, Shield, ShieldAlert, ShieldCheck, ShieldX, Upload, X } from "lucide-react";
import { cn, formatOperatorFullName } from "@/lib/utils";

type OQStatus = "active" | "expiring_soon" | "expired" | "missing";

function getOQStatus(oq: OperatorQualificationWithDetails): OQStatus {
  if (!oq.expirationDate) return "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = parseISO(oq.expirationDate);
  const daysUntilExpiry = differenceInDays(expDate, today);
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 30) return "expiring_soon";
  return "active";
}

function getStatusBadge(status: OQStatus) {
  switch (status) {
    case "active":
      return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200" data-testid="badge-status-active"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
    case "expiring_soon":
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200" data-testid="badge-status-expiring"><Clock className="w-3 h-3 mr-1" />Expiring Soon</Badge>;
    case "expired":
      return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200" data-testid="badge-status-expired"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
    case "missing":
      return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-200" data-testid="badge-status-missing"><AlertTriangle className="w-3 h-3 mr-1" />Missing</Badge>;
  }
}

function getDaysLabel(expirationDate: string | null) {
  if (!expirationDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = parseISO(expirationDate);
  const days = differenceInDays(expDate, today);
  if (days < 0) return <span className="text-red-500 text-xs font-medium">Expired {Math.abs(days)}d ago</span>;
  if (days === 0) return <span className="text-red-500 text-xs font-medium">Expires today</span>;
  if (days <= 30) return <span className="text-amber-500 text-xs font-medium">{days}d remaining</span>;
  return <span className="text-muted-foreground text-xs">{days}d remaining</span>;
}

type MatrixRow = {
  operator: Operator;
  quals: Array<{
    qualification: Qualification;
    oq: OperatorQualificationWithDetails | null;
    status: OQStatus;
  }>;
  completionPct: number;
};

function isAssistantOperator(op: Operator): boolean {
  return op.operatorType === "assistant" || op.isAssistantOnly;
}

export default function OQDashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOperator, setFilterOperator] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOQ, setEditingOQ] = useState<OperatorQualificationWithDetails | null>(null);
  const [formData, setFormData] = useState({
    operatorId: "",
    qualificationId: "",
    issueDate: "",
    expirationDate: "",
    documentName: "",
    documentUrl: "",
    documentObjectPath: "",
    notes: "",
    status: "active",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress } = useUpload();

  const { data: operators = [], isLoading: loadingOps } = useQuery<Operator[]>({
    queryKey: ["/api/operators"],
  });

  const { data: qualifications = [], isLoading: loadingQuals } = useQuery<Qualification[]>({
    queryKey: ["/api/qualifications"],
  });

  const { data: operatorQualifications = [], isLoading: loadingOQs } = useQuery<OperatorQualificationWithDetails[]>({
    queryKey: ["/api/operator-qualifications"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/operator-qualifications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-qualifications"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "OQ record added successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error adding OQ", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PUT", `/api/operator-qualifications/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-qualifications"] });
      setDialogOpen(false);
      setEditingOQ(null);
      resetForm();
      toast({ title: "OQ record updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating OQ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/operator-qualifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operator-qualifications"] });
      toast({ title: "OQ record deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error deleting OQ", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormData({
      operatorId: "",
      qualificationId: "",
      issueDate: "",
      expirationDate: "",
      documentName: "",
      documentUrl: "",
      documentObjectPath: "",
      notes: "",
      status: "active",
    });
  }

  function handleEdit(oq: OperatorQualificationWithDetails) {
    setEditingOQ(oq);
    setFormData({
      operatorId: String(oq.operatorId),
      qualificationId: String(oq.qualificationId),
      issueDate: oq.issueDate || "",
      expirationDate: oq.expirationDate || "",
      documentName: oq.documentName || "",
      documentUrl: oq.documentUrl || "",
      documentObjectPath: oq.documentUrl || "",
      notes: oq.notes || "",
      status: oq.status,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      operatorId: Number(formData.operatorId),
      qualificationId: Number(formData.qualificationId),
      issueDate: formData.issueDate || null,
      expirationDate: formData.expirationDate || null,
      documentName: formData.documentName || null,
      documentUrl: formData.documentObjectPath || formData.documentUrl || null,
      notes: formData.notes || null,
      status: formData.status,
    };
    if (editingOQ) {
      updateMutation.mutate({ id: editingOQ.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) {
      setFormData(f => ({
        ...f,
        documentUrl: result.objectPath,
        documentObjectPath: result.objectPath,
        documentName: f.documentName || result.metadata.name,
      }));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemoveDocument() {
    setFormData(f => ({
      ...f,
      documentUrl: "",
      documentObjectPath: "",
    }));
  }

  const activeOperators = operators.filter(op => op.isActive);

  const oqsWithStatus = useMemo(() => {
    return operatorQualifications.map(oq => ({
      ...oq,
      derivedStatus: getOQStatus(oq),
    }));
  }, [operatorQualifications]);

  const stats = useMemo(() => {
    const active = oqsWithStatus.filter(o => o.derivedStatus === "active").length;
    const expiringSoon = oqsWithStatus.filter(o => o.derivedStatus === "expiring_soon").length;
    const expired = oqsWithStatus.filter(o => o.derivedStatus === "expired").length;

    const operatorOQMap = new Map<number, Set<number>>();
    oqsWithStatus.forEach(oq => {
      if (!operatorOQMap.has(oq.operatorId)) operatorOQMap.set(oq.operatorId, new Set());
      operatorOQMap.get(oq.operatorId)!.add(oq.qualificationId);
    });

    let missingCount = 0;
    activeOperators.forEach(op => {
      const held = operatorOQMap.get(op.id) || new Set();
      qualifications.forEach(q => {
        if (!held.has(q.id)) missingCount++;
      });
    });

    return { active, expiringSoon, expired, missing: missingCount, total: oqsWithStatus.length };
  }, [oqsWithStatus, activeOperators, qualifications]);

  function buildMatrix(ops: Operator[]): MatrixRow[] {
    const matrix: MatrixRow[] = [];

    const oqMap = new Map<string, OperatorQualificationWithDetails>();
    oqsWithStatus.forEach(oq => {
      oqMap.set(`${oq.operatorId}-${oq.qualificationId}`, oq);
    });

    ops.forEach(op => {
      const quals = qualifications.map(q => {
        const oq = oqMap.get(`${op.id}-${q.id}`) || null;
        const status: OQStatus = oq ? getOQStatus(oq) : "missing";
        return { qualification: q, oq, status };
      });

      const heldCount = quals.filter(q => q.status === "active" || q.status === "expiring_soon").length;
      const completionPct = qualifications.length > 0 ? Math.round((heldCount / qualifications.length) * 100) : 0;

      matrix.push({ operator: op, quals, completionPct });
    });

    return matrix;
  }

  const localOperatorMatrix = useMemo(() => {
    const localOps = activeOperators
      .filter(op => !op.isOutOfState)
      .sort((a, b) => {
        const aIsAssistant = isAssistantOperator(a) ? 1 : 0;
        const bIsAssistant = isAssistantOperator(b) ? 1 : 0;
        if (aIsAssistant !== bIsAssistant) return aIsAssistant - bIsAssistant;
        return a.lastName.localeCompare(b.lastName);
      });
    return buildMatrix(localOps);
  }, [activeOperators, qualifications, oqsWithStatus]);

  const oosOperatorMatrix = useMemo(() => {
    const oosOps = activeOperators
      .filter(op => op.isOutOfState)
      .sort((a, b) => {
        const groupCompare = a.groupName.localeCompare(b.groupName);
        if (groupCompare !== 0) return groupCompare;
        return a.lastName.localeCompare(b.lastName);
      });
    return buildMatrix(oosOps);
  }, [activeOperators, qualifications, oqsWithStatus]);

  const oosGroupNames = useMemo(() => {
    const groups: string[] = [];
    oosOperatorMatrix.forEach(row => {
      if (!groups.includes(row.operator.groupName)) {
        groups.push(row.operator.groupName);
      }
    });
    return groups;
  }, [oosOperatorMatrix]);

  const filteredOQs = useMemo(() => {
    let filtered = oqsWithStatus;

    if (filterStatus !== "all") {
      filtered = filtered.filter(oq => oq.derivedStatus === filterStatus);
    }

    if (filterOperator !== "all") {
      filtered = filtered.filter(oq => String(oq.operatorId) === filterOperator);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(oq =>
        (oq.operator ? formatOperatorFullName(oq.operator).toLowerCase().includes(lower) : false) ||
        oq.qualification?.name?.toLowerCase().includes(lower) ||
        oq.documentName?.toLowerCase().includes(lower) ||
        oq.notes?.toLowerCase().includes(lower)
      );
    }

    return filtered;
  }, [oqsWithStatus, filterStatus, filterOperator, searchTerm]);

  const urgentItems = useMemo(() => {
    return oqsWithStatus
      .filter(oq => oq.derivedStatus === "expired" || oq.derivedStatus === "expiring_soon")
      .sort((a, b) => {
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return a.expirationDate.localeCompare(b.expirationDate);
      });
  }, [oqsWithStatus]);

  const isLoading = loadingOps || loadingQuals || loadingOQs;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function renderMatrixRow(row: MatrixRow, idx: number) {
    return (
      <tr key={row.operator.id} className={cn("border-b", idx % 2 === 1 && "bg-muted/20")} data-testid={`row-operator-${row.operator.id}`}>
        <td className={cn("p-3 sticky left-0", idx % 2 === 1 ? "bg-muted/20" : "bg-background")}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: getOperatorColor(row.operator) }} />
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{formatOperatorFullName(row.operator)}</div>
              <div className="text-xs text-muted-foreground truncate">{row.operator.groupName}</div>
            </div>
          </div>
        </td>
        <td className="p-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <Progress value={row.completionPct} className="w-16 h-1.5" />
            <span className="text-xs text-muted-foreground">{row.completionPct}%</span>
          </div>
        </td>
        {row.quals.map(q => (
          <td key={q.qualification.id} className="p-2 text-center" data-testid={`cell-oq-${row.operator.id}-${q.qualification.id}`}>
            {q.status === "active" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => q.oq && handleEdit(q.oq)}
                className="bg-emerald-500/15"
                title={q.oq?.expirationDate ? `Expires: ${format(parseISO(q.oq.expirationDate), "MM/dd/yyyy")}` : "Active (no expiry)"}
                data-testid={`button-oq-active-${row.operator.id}-${q.qualification.id}`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </Button>
            )}
            {q.status === "expiring_soon" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => q.oq && handleEdit(q.oq)}
                className="bg-amber-500/15"
                title={q.oq?.expirationDate ? `Expires: ${format(parseISO(q.oq.expirationDate), "MM/dd/yyyy")}` : ""}
                data-testid={`button-oq-expiring-${row.operator.id}-${q.qualification.id}`}
              >
                <Clock className="w-4 h-4 text-amber-600" />
              </Button>
            )}
            {q.status === "expired" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => q.oq && handleEdit(q.oq)}
                className="bg-red-500/15"
                title={q.oq?.expirationDate ? `Expired: ${format(parseISO(q.oq.expirationDate), "MM/dd/yyyy")}` : ""}
                data-testid={`button-oq-expired-${row.operator.id}-${q.qualification.id}`}
              >
                <XCircle className="w-4 h-4 text-red-600" />
              </Button>
            )}
            {q.status === "missing" && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditingOQ(null);
                  setFormData({
                    ...formData,
                    operatorId: String(row.operator.id),
                    qualificationId: String(q.qualification.id),
                    issueDate: "",
                    expirationDate: "",
                    documentName: "",
                    documentUrl: "",
                    documentObjectPath: "",
                    notes: "",
                    status: "active",
                  });
                  setDialogOpen(true);
                }}
                className="bg-muted/50"
                title="Not on file - click to add"
                data-testid={`button-oq-missing-${row.operator.id}-${q.qualification.id}`}
              >
                <span className="text-muted-foreground text-lg leading-none">-</span>
              </Button>
            )}
          </td>
        ))}
      </tr>
    );
  }

  function renderMatrixTable(matrixRows: MatrixRow[], showAssistantDivider: boolean) {
    let assistantDividerInserted = false;
    const rows: JSX.Element[] = [];
    let rowIdx = 0;

    matrixRows.forEach((row) => {
      if (showAssistantDivider && !assistantDividerInserted && isAssistantOperator(row.operator)) {
        assistantDividerInserted = true;
        rows.push(
          <tr key="assistant-divider" className="border-b bg-muted/20">
            <td colSpan={qualifications.length + 2} className="px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Assistants</span>
            </td>
          </tr>
        );
        rowIdx = 0;
      }
      rows.push(renderMatrixRow(row, rowIdx));
      rowIdx++;
    });

    return rows;
  }

  function renderOOSMatrixTable() {
    const rows: JSX.Element[] = [];

    oosGroupNames.forEach(groupName => {
      const groupRows = oosOperatorMatrix.filter(row => row.operator.groupName === groupName);
      rows.push(
        <tr key={`oos-group-${groupName}`} className="border-b bg-muted/20">
          <td colSpan={qualifications.length + 2} className="px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{groupName}</span>
          </td>
        </tr>
      );
      groupRows.forEach((row, idx) => {
        rows.push(renderMatrixRow(row, idx));
      });
    });

    return rows;
  }

  const isImageUrl = (url: string) => {
    return url && (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) || url.startsWith("/objects/"));
  };

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl mx-auto" data-testid="oq-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Qualifications</h1>
          <p className="text-sm text-muted-foreground">Track OQ status, expirations, and compliance for all operators</p>
        </div>
        <Button
          onClick={() => {
            setEditingOQ(null);
            resetForm();
            setDialogOpen(true);
          }}
          data-testid="button-add-oq"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add OQ Record
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card data-testid="card-stat-active">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/10">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active OQs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-expiring">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/10">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-expired">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/10">
                <ShieldX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.expired}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-missing">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-gray-500/10">
                <Shield className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.missing}</p>
                <p className="text-xs text-muted-foreground">Not on File</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="local" className="space-y-3">
        <TabsList data-testid="tabs-oq-view">
          <TabsTrigger value="local" data-testid="tab-local">Local</TabsTrigger>
          <TabsTrigger value="oos" data-testid="tab-oos">Out of State</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            Alerts
            {urgentItems.length > 0 && (
              <Badge variant="outline" className="ml-2 bg-red-500/10 text-red-600 border-red-200 text-xs">
                {urgentItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="records" data-testid="tab-records">All Records</TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="space-y-3">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/30 min-w-[180px]">Operator</th>
                      <th className="text-center p-3 font-medium text-muted-foreground min-w-[80px]">Status</th>
                      {qualifications.map(q => (
                        <th key={q.id} className="text-center p-2 font-medium text-muted-foreground min-w-[90px]">
                          <span className="text-xs">{q.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {renderMatrixTable(localOperatorMatrix, true)}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oos" className="space-y-3">
          {oosOperatorMatrix.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No Out of State Operators</p>
                <p className="text-sm text-muted-foreground">There are no active out-of-state operators to display</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/30 min-w-[180px]">Operator</th>
                        <th className="text-center p-3 font-medium text-muted-foreground min-w-[80px]">Status</th>
                        {qualifications.map(q => (
                          <th key={q.id} className="text-center p-2 font-medium text-muted-foreground min-w-[90px]">
                            <span className="text-xs">{q.name}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {renderOOSMatrixTable()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-3">
          {urgentItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheck className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-lg font-medium">All Clear</p>
                <p className="text-sm text-muted-foreground">No expiring or expired qualifications at this time</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {urgentItems.map(oq => (
                <Card key={oq.id} data-testid={`alert-oq-${oq.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-1 h-10 rounded-full shrink-0",
                          oq.derivedStatus === "expired" ? "bg-red-500" : "bg-amber-500"
                        )} />
                        {oq.derivedStatus === "expired" ? (
                          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm" data-testid={`text-alert-operator-${oq.id}`}>{oq.operator ? formatOperatorFullName(oq.operator) : "Unknown"}</span>
                            <span className="text-muted-foreground text-sm">-</span>
                            <span className="text-sm" data-testid={`text-alert-qual-${oq.id}`}>{oq.qualification?.name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {oq.expirationDate && (
                              <span className="text-xs text-muted-foreground" data-testid={`text-alert-expiry-${oq.id}`}>
                                Exp: {format(parseISO(oq.expirationDate), "MM/dd/yyyy")}
                              </span>
                            )}
                            {getDaysLabel(oq.expirationDate)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(oq.derivedStatus)}
                        <Button size="sm" variant="outline" onClick={() => handleEdit(oq)} data-testid={`button-edit-alert-${oq.id}`}>
                          <Pencil className="w-3 h-3 mr-1" />
                          Update
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search OQs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-oq"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOperator} onValueChange={setFilterOperator}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-operator">
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operators</SelectItem>
                {activeOperators.map(op => (
                  <SelectItem key={op.id} value={String(op.id)}>{formatOperatorFullName(op)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredOQs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No Records Found</p>
                <p className="text-sm text-muted-foreground">
                  {operatorQualifications.length === 0
                    ? "Add OQ records to start tracking operator qualifications"
                    : "No records match your current filters"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Operator</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Qualification</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Issue Date</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Expiration</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Document</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOQs.map((oq, idx) => (
                      <tr key={oq.id} className={cn("border-b", idx % 2 === 1 && "bg-muted/20")} data-testid={`row-oq-${oq.id}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-6 rounded-full shrink-0" style={{ backgroundColor: oq.operator ? getOperatorColor(oq.operator) : "#888" }} />
                            <span className="font-medium">{oq.operator ? formatOperatorFullName(oq.operator) : "Unknown"}</span>
                          </div>
                        </td>
                        <td className="p-3">{oq.qualification?.name || "Unknown"}</td>
                        <td className="p-3">{getStatusBadge(oq.derivedStatus)}</td>
                        <td className="p-3 text-muted-foreground">
                          {oq.issueDate ? format(parseISO(oq.issueDate), "MM/dd/yyyy") : "-"}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5">
                            <span>{oq.expirationDate ? format(parseISO(oq.expirationDate), "MM/dd/yyyy") : "No expiry"}</span>
                            {getDaysLabel(oq.expirationDate)}
                          </div>
                        </td>
                        <td className="p-3">
                          {oq.documentName ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <FileText className="w-3 h-3" />
                              <span className="text-xs truncate max-w-[120px]">{oq.documentName}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(oq)} data-testid={`button-edit-oq-${oq.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Delete this OQ record?")) {
                                  deleteMutation.mutate(oq.id);
                                }
                              }}
                              data-testid={`button-delete-oq-${oq.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOQ ? "Edit OQ Record" : "Add OQ Record"}</DialogTitle>
            <DialogDescription>
              {editingOQ
                ? "Update the qualification details for this operator."
                : "Add a new qualification record for an operator."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oq-operator">Operator</Label>
              <Select
                value={formData.operatorId}
                onValueChange={v => setFormData(f => ({ ...f, operatorId: v }))}
              >
                <SelectTrigger data-testid="select-oq-operator">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {activeOperators.map(op => (
                    <SelectItem key={op.id} value={String(op.id)}>{formatOperatorFullName(op)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="oq-qualification">Qualification</Label>
              <Select
                value={formData.qualificationId}
                onValueChange={v => setFormData(f => ({ ...f, qualificationId: v }))}
              >
                <SelectTrigger data-testid="select-oq-qualification">
                  <SelectValue placeholder="Select qualification" />
                </SelectTrigger>
                <SelectContent>
                  {qualifications.map(q => (
                    <SelectItem key={q.id} value={String(q.id)}>{q.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="oq-issue-date">Issue Date</Label>
                <Input
                  id="oq-issue-date"
                  type="date"
                  value={formData.issueDate}
                  onChange={e => setFormData(f => ({ ...f, issueDate: e.target.value }))}
                  data-testid="input-oq-issue-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oq-expiration-date">Expiration Date</Label>
                <Input
                  id="oq-expiration-date"
                  type="date"
                  value={formData.expirationDate}
                  onChange={e => setFormData(f => ({ ...f, expirationDate: e.target.value }))}
                  data-testid="input-oq-expiration-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="oq-document-name">Document Name</Label>
              <Input
                id="oq-document-name"
                placeholder="e.g., Enbridge OQ Certificate"
                value={formData.documentName}
                onChange={e => setFormData(f => ({ ...f, documentName: e.target.value }))}
                data-testid="input-oq-document-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Document Scan</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-oq-document-file"
              />
              {formData.documentUrl && isImageUrl(formData.documentUrl) && (
                <div className="relative w-full h-32 rounded-md overflow-hidden bg-muted mb-2">
                  <img
                    src={formData.documentUrl}
                    alt="Document preview"
                    className="w-full h-full object-contain"
                    data-testid="img-oq-document-preview"
                  />
                </div>
              )}
              {formData.documentUrl && !isImageUrl(formData.documentUrl) && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted mb-2" data-testid="link-oq-document">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={formData.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary truncate">
                    {formData.documentName || formData.documentUrl}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-document"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {isUploading ? "Uploading..." : "Choose File"}
                </Button>
                {formData.documentUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveDocument}
                    data-testid="button-remove-document"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
              {isUploading && (
                <Progress value={progress} className="w-full h-1.5 mt-2" data-testid="progress-upload" />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="oq-notes">Notes</Label>
              <Input
                id="oq-notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                data-testid="input-oq-notes"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingOQ(null); }} data-testid="button-cancel-oq">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!formData.operatorId || !formData.qualificationId || createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-oq"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingOQ ? "Update" : "Add Record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
