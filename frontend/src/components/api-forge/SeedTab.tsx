import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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

export default function SeedTab({ projectId }: SeedTabProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState<Record<string, boolean>>({});
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
                for (const resource of mapped) {
                    initialCounts[resource.id] = 10;
                }
                setCounts(initialCounts);
                setResources(mapped);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to load resources");
                setResources([]);
            } finally {
                setLoading(false);
            }
        };

        fetchResources();
    }, [apiBase, projectId]);

    const seed = async (resource: Resource) => {
        const count = counts[resource.id] ?? 10;
        setSeeding((prev) => ({ ...prev, [resource.id]: true }));

        try {
            let created = 0;
            for (let i = 0; i < count; i++) {
                const body = {
                    recordFields: resource.fields.map((field) => ({
                        name: field.name,
                        value: randomValue(field.type),
                    })),
                };

                const response = await fetch(`${apiBase}/api/${resource.name}`, {
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

            toast.success(`Seeded ${created} record${created === 1 ? "" : "s"} into /${resource.name}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Seeding failed");
        } finally {
            setSeeding((prev) => ({ ...prev, [resource.id]: false }));
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
                {resources.map((resource) => (
                    <Card key={resource.id} className="overflow-hidden">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 font-mono text-lg">
                                <Database className="h-4 w-4 text-primary" />/{resource.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
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
                                        {resource.fields.length} field{resource.fields.length === 1 ? "" : "s"}
                                    </Badge>
                                    <Button
                                        onClick={() => seed(resource)}
                                        disabled={seeding[resource.id]}
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        {seeding[resource.id] ? "Seeding..." : "Generate"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </TabsContent>
    );
}
