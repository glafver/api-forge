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
import { Database, RefreshCw } from "lucide-react";
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
}

export default function DataTab({ projectId, refreshKey = 0 }: DataTabProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [records, setRecords] = useState<Record<string, RecordRow[]>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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
        load();
    }, [load, refreshKey]);

    const refresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
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
                                <CardTitle className="flex items-center gap-2 font-mono text-lg">
                                    <Database className="h-4 w-4 text-primary" />/{resource.name}
                                    <Badge variant="secondary">{rows.length} record{rows.length === 1 ? "" : "s"}</Badge>
                                </CardTitle>
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
        </TabsContent>
    );
}
