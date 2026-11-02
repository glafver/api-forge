import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Database, Sparkles } from "lucide-react";
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

interface SeedTabProps {
    projectId?: string;
    refreshKey?: number;
}

function randomValue(type: string): string {
    switch (type.toLowerCase()) {
        case "int":
            return String(Math.floor(Math.random() * 1000));
        case "double":
            return (Math.random() * 1000).toFixed(2);
        case "bool":
            return Math.random() > 0.5 ? "true" : "false";
        case "guid":
            return crypto.randomUUID();
        default:
            return `sample_${Math.random().toString(36).slice(2, 8)}`;
    }
}

function defaultValue(type: string): string {
    switch (type.toLowerCase()) {
        case "int":
            return "0";
        case "double":
            return "0";
        case "bool":
            return "false";
        case "guid":
            return "00000000-0000-0000-0000-000000000000";
        default:
            return "";
    }
}

export default function SeedTab({ projectId, refreshKey = 0 }: SeedTabProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [existingCounts, setExistingCounts] = useState<Record<string, number>>({});
    const [selected, setSelected] = useState<Record<string, Set<string>>>({});
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState<Record<string, boolean>>({});
    const [prompt, setPrompt] = useState<Resource | null>(null);
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

    useEffect(() => {
        const fetchResources = async () => {
            if (!projectId) {
                setResources([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const response = await fetch(`${apiBase}/api/projects/${projectId}/definitions`, {
                    credentials: "include",
                });

                if (!response.ok) {
                    toast.error(await parseErrorMessage(response));
                    setResources([]);
                    return;
                }

                const data = (await response.json()) as ResourceResponse[];
                const mapped: Resource[] = (data ?? []).map((model) => ({
                    id: model.Id ?? model.id ?? "",
                    name: model.Name ?? model.name ?? "",
                    fields: (model.Fields ?? model.fields ?? []).map((field) => ({
                        name: field.Name ?? field.name ?? "",
                        type: field.Type ?? field.type ?? "string",
                    })),
                }));

                const initialCounts: Record<string, number> = {};
                const initialSelected: Record<string, Set<string>> = {};
                const initialExisting: Record<string, number> = {};
                for (const resource of mapped) {
                    initialCounts[resource.id] = 10;
                    initialSelected[resource.id] = new Set(resource.fields.map((field) => field.name));

                    try {
                        const recResp = await fetch(
                            `${apiBase}/api/projects/${projectId}/${resource.name}?page=1&pageSize=1`,
                            { credentials: "include" },
                        );
                        if (recResp.ok) {
                            const recData = await recResp.json();
                            initialExisting[resource.id] = recData.totalCount ?? 0;
                        }
                    } catch {
                        initialExisting[resource.id] = 0;
                    }
                }
                setCounts(initialCounts);
                setSelected(initialSelected);
                setExistingCounts(initialExisting);
                setResources(mapped);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to load resources");
                setResources([]);
            } finally {
                setLoading(false);
            }
        };

        fetchResources();
    }, [apiBase, projectId, refreshKey]);

    const toggleField = (resourceId: string, fieldName: string) => {
        setSelected((prev) => {
            const next = new Set(prev[resourceId] ?? []);
            if (next.has(fieldName)) {
                next.delete(fieldName);
            } else {
                next.add(fieldName);
            }
            return { ...prev, [resourceId]: next };
        });
    };

    const seedNew = async (resource: Resource) => {
        const count = counts[resource.id] ?? 10;
        const selectedFields = selected[resource.id] ?? new Set(resource.fields.map((field) => field.name));
        setSeeding((prev) => ({ ...prev, [resource.id]: true }));

        try {
            let created = 0;
            for (let i = 0; i < count; i++) {
                const body = {
                    recordFields: resource.fields.map((field) => ({
                        name: field.name,
                        value: selectedFields.has(field.name)
                            ? randomValue(field.type)
                            : defaultValue(field.type),
                    })),
                };

                const response = await fetch(`${apiBase}/api/projects/${projectId}/${resource.name}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const error = await parseErrorMessage(response);
                    toast.error(`Seed stopped: ${error}`);
                    break;
                }
                created++;
            }

            toast.success(`Added ${created} new record${created === 1 ? "" : "s"} into /${resource.name}`);
            setExistingCounts((prev) => ({
                ...prev,
                [resource.id]: (prev[resource.id] ?? 0) + created,
            }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Seeding failed");
        } finally {
            setSeeding((prev) => ({ ...prev, [resource.id]: false }));
        }
    };

    const fillExisting = async (resource: Resource) => {
        const selectedFields = selected[resource.id] ?? new Set(resource.fields.map((field) => field.name));
        setSeeding((prev) => ({ ...prev, [resource.id]: true }));

        try {
            const recResp = await fetch(
                `${apiBase}/api/projects/${projectId}/${resource.name}?page=1&pageSize=100`,
                { credentials: "include" },
            );
            if (!recResp.ok) {
                toast.error(await parseErrorMessage(recResp));
                return;
            }

            const recData = await recResp.json();
            const items = (recData.items ?? []) as {
                id: string;
                fields?: { name: string; value: string }[];
            }[];

            let updated = 0;
            for (const item of items) {
                const values: Record<string, string> = {};
                for (const field of item.fields ?? []) {
                    values[field.name] = field.value;
                }

                let changed = false;
                const recordFields = resource.fields.map((field) => {
                    let value = values[field.name] ?? "";
                    if (selectedFields.has(field.name) && value === "") {
                        value = randomValue(field.type);
                        changed = true;
                    }
                    return { name: field.name, value };
                });

                if (!changed) continue;

                const resp = await fetch(
                    `${apiBase}/api/projects/${projectId}/${resource.name}/${item.id}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ recordFields }),
                    },
                );

                if (!resp.ok) {
                    const error = await parseErrorMessage(resp);
                    toast.error(`Fill stopped: ${error}`);
                    break;
                }
                updated++;
            }

            toast.success(
                updated === 0
                    ? `Nothing to fill in /${resource.name}`
                    : `Filled ${updated} record${updated === 1 ? "" : "s"} in /${resource.name}`,
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to fill records");
        } finally {
            setSeeding((prev) => ({ ...prev, [resource.id]: false }));
        }
    };

    const handleGenerate = (resource: Resource) => {
        if ((existingCounts[resource.id] ?? 0) > 0) {
            setPrompt(resource);
        } else {
            seedNew(resource);
        }
    };

    if (!projectId) {
        return (
            <TabsContent value="seed" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Select a project to seed data.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    if (loading) {
        return (
            <TabsContent value="seed" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Loading...</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    if (resources.length === 0) {
        return (
            <TabsContent value="seed" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Create a resource first, then seed it with mock data.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    return (
        <TabsContent value="seed" className="mt-4">
            <div className="space-y-4">
                {resources.map((resource) => {
                    const selectedFields = selected[resource.id] ?? new Set(resource.fields.map((field) => field.name));
                    const existing = existingCounts[resource.id] ?? 0;

                    return (
                        <Card key={resource.id} className="overflow-hidden">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 font-mono text-lg">
                                    <Database className="h-4 w-4 text-primary" />/{resource.name}
                                    <Badge variant="secondary">{existing} existing</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {resource.fields.length > 0 && (
                                    <div>
                                        <label className="mb-2 block text-xs font-medium text-muted-foreground">
                                            Fields to generate
                                        </label>
                                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                                            {resource.fields.map((field) => (
                                                <label
                                                    key={field.name}
                                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                                >
                                                    <Checkbox
                                                        checked={selectedFields.has(field.name)}
                                                        onCheckedChange={() => toggleField(resource.id, field.name)}
                                                    />
                                                    <span className="font-mono">{field.name}</span>
                                                    <span className="text-xs text-muted-foreground">{field.type}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Unchecked fields get a default value.
                                        </p>
                                    </div>
                                )}

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <div className="flex-1">
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                            Number of records
                                        </label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={1000}
                                            value={counts[resource.id] ?? 10}
                                            onChange={(event) =>
                                                setCounts((prev) => ({
                                                    ...prev,
                                                    [resource.id]: Number(event.target.value) || 1,
                                                }))
                                            }
                                            className="max-w-[160px]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">
                                            {selectedFields.size}/{resource.fields.length} fields
                                        </Badge>
                                        <Button
                                            onClick={() => handleGenerate(resource)}
                                            disabled={seeding[resource.id] || selectedFields.size === 0}
                                        >
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            {seeding[resource.id] ? "Working..." : "Generate"}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={prompt !== null} onOpenChange={(open) => !open && setPrompt(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Seed /{prompt?.name}</DialogTitle>
                        <DialogDescription>
                            This resource already has {prompt ? existingCounts[prompt.id] ?? 0 : 0} record
                            {(prompt ? existingCounts[prompt.id] ?? 0 : 0) === 1 ? "" : "s"}. What would you
                            like to do?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        <Button
                            onClick={() => {
                                const resource = prompt;
                                setPrompt(null);
                                if (resource) fillExisting(resource);
                            }}
                        >
                            Fill empty fields in existing records
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                const resource = prompt;
                                setPrompt(null);
                                if (resource) seedNew(resource);
                            }}
                        >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Add new records
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </TabsContent>
    );
}
