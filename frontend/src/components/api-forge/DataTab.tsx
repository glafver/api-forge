import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Database, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface FieldResponse {
    Id?: string;
    Name?: string;
    Type?: string;
    id?: string;
    name?: string;
    type?: string;
}

interface ResourceResponse {
    Id?: string;
    Name?: string;
    Fields?: FieldResponse[];
    id?: string;
    name?: string;
    fields?: FieldResponse[];
}

interface Resource {
    id: string;
    name: string;
    fields: { name: string; type: string }[];
}

interface RecordRow {
    id: string;
    values: Record<string, string>;
}

interface DataTabProps {
    projectId?: string;
    refreshKey?: number;
    active?: boolean;
}

interface ConfirmTarget {
    resource: Resource;
    recordId?: string;
}

export default function DataTab({ projectId, refreshKey = 0, active = true }: DataTabProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [records, setRecords] = useState<Record<string, RecordRow[]>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
    const [editTarget, setEditTarget] = useState<{ resource: Resource; record: RecordRow } | null>(null);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

    const parseErrorMessage = async (response: Response) => {
        try {
            const data = await response.json();
            if (typeof data?.Message === "string") return data.Message;
            if (typeof data?.message === "string") return data.message;
            if (typeof data?.error === "string") return data.error;
        } catch {
            console.error("Failed to parse error response");
        }
        return response.statusText || "Request failed";
    };

    const load = useCallback(async () => {
        if (!projectId) {
            setResources([]);
            setRecords({});
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const defsResp = await fetch(`${apiBase}/api/projects/${projectId}/definitions`, {
                credentials: "include",
            });

            if (!defsResp.ok) {
                toast.error(await parseErrorMessage(defsResp));
                setResources([]);
                setRecords({});
                return;
            }

            const defs = (await defsResp.json()) as ResourceResponse[];
            const mapped: Resource[] = (defs ?? []).map((model) => ({
                id: model.Id ?? model.id ?? "",
                name: model.Name ?? model.name ?? "",
                fields: (model.Fields ?? model.fields ?? []).map((field) => ({
                    name: field.Name ?? field.name ?? "",
                    type: field.Type ?? field.type ?? "string",
                })),
            }));
            setResources(mapped);

            const recMap: Record<string, RecordRow[]> = {};
            for (const resource of mapped) {
                const recResp = await fetch(
                    `${apiBase}/api/projects/${projectId}/${resource.name}?page=1&pageSize=100`,
                    { credentials: "include" },
                );
                if (!recResp.ok) continue;

                const recData = await recResp.json();
                const items = (recData.items ?? []) as {
                    id: string;
                    fields?: { name: string; value: string }[];
                }[];

                recMap[resource.id] = items.map((item) => {
                    const values: Record<string, string> = {};
                    for (const field of item.fields ?? []) {
                        values[field.name] = field.value;
                    }
                    return { id: item.id ?? "", values };
                });
            }
            setRecords(recMap);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load data");
            setResources([]);
            setRecords({});
        } finally {
            setLoading(false);
        }
    }, [apiBase, projectId]);

    useEffect(() => {
        if (active) {
            load();
        }
    }, [active, load, refreshKey]);

    const refresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const deleteRecord = async (resource: Resource, recordId: string) => {
        try {
            const resp = await fetch(
                `${apiBase}/api/projects/${projectId}/${resource.name}/${recordId}`,
                { method: "DELETE", credentials: "include" },
            );
            if (!resp.ok) {
                toast.error(await parseErrorMessage(resp));
                return;
            }
            toast.success("Record deleted");
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete record");
        }
    };

    const clearAll = async (resource: Resource) => {
        try {
            const resp = await fetch(`${apiBase}/api/projects/${projectId}/${resource.name}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!resp.ok) {
                toast.error(await parseErrorMessage(resp));
                return;
            }
            const data = await resp.json().catch(() => null);
            const deleted = data?.deleted ?? 0;
            toast.success(`Cleared ${deleted} record${deleted === 1 ? "" : "s"}`);
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to clear records");
        }
    };

    const openEdit = (resource: Resource, record: RecordRow) => {
        setEditTarget({ resource, record });
        setEditValues(record.values);
    };

    const saveEdit = async () => {
        if (!editTarget) return;
        const { resource, record } = editTarget;
        try {
            const recordFields = resource.fields.map((field) => ({
                name: field.name,
                value: editValues[field.name] ?? "",
            }));
            const resp = await fetch(
                `${apiBase}/api/projects/${projectId}/${resource.name}/${record.id}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ recordFields }),
                },
            );
            if (!resp.ok) {
                toast.error(await parseErrorMessage(resp));
                return;
            }
            toast.success("Record updated");
            setEditTarget(null);
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update record");
        }
    };

    if (!projectId) {
        return (
            <TabsContent value="data" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Select a project to browse its data.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    if (loading) {
        return (
            <TabsContent value="data" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Loading data...</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    if (resources.length === 0) {
        return (
            <TabsContent value="data" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Create a resource first, then seed or add records.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    return (
        <TabsContent value="data" className="mt-4">
            <div className="mb-4 flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>
            <div className="space-y-4">
                {resources.map((resource) => {
                    const rows = records[resource.id] ?? [];
                    const columns = resource.fields.map((field) => field.name);

                    return (
                        <Card key={resource.id} className="overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 font-mono text-lg">
                                        <Database className="h-4 w-4 text-primary" />/{resource.name}
                                        <Badge variant="secondary">{rows.length} record{rows.length === 1 ? "" : "s"}</Badge>
                                    </CardTitle>
                                    {rows.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            onClick={() => setConfirm({ resource })}
                                        >
                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                            Clear all
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {columns.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No fields defined yet.</p>
                                ) : rows.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No records yet. Use Seed Data to add some.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="font-mono text-xs">id</TableHead>
                                                    {columns.map((column) => (
                                                        <TableHead key={column} className="font-mono text-xs">
                                                            {column}
                                                        </TableHead>
                                                    ))}
                                                    <TableHead />
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {rows.map((row) => (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                                            {row.id.slice(0, 8)}
                                                        </TableCell>
                                                        {columns.map((column) => (
                                                            <TableCell key={column} className="font-mono text-xs">
                                                                {row.values[column] ?? ""}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => openEdit(resource, row)}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => setConfirm({ resource, recordId: row.id })}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <ConfirmDialog
                open={confirm !== null}
                title={
                    confirm?.recordId
                        ? "Delete this record?"
                        : `Clear all records in /${confirm?.resource.name}?`
                }
                description={
                    confirm?.recordId
                        ? "This will permanently remove the record."
                        : "This will permanently remove all records in this resource."
                }
                confirmLabel={confirm?.recordId ? "Delete" : "Clear all"}
                confirmClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onConfirm={() => {
                    const target = confirm;
                    setConfirm(null);
                    if (target) {
                        if (target.recordId) {
                            deleteRecord(target.resource, target.recordId);
                        } else {
                            clearAll(target.resource);
                        }
                    }
                }}
                onOpenChange={(open) => !open && setConfirm(null)}
            />

            <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit record</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {editTarget?.resource.fields.map((field) => (
                            <div key={field.name} className="space-y-1.5">
                                <Label className="font-mono text-xs">{field.name}</Label>
                                <Input
                                    value={editValues[field.name] ?? ""}
                                    onChange={(event) =>
                                        setEditValues((prev) => ({
                                            ...prev,
                                            [field.name]: event.target.value,
                                        }))
                                    }
                                    className="font-mono text-sm"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setEditTarget(null)}>
                            Cancel
                        </Button>
                        <Button onClick={saveEdit}>Save</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </TabsContent>
    );
}
