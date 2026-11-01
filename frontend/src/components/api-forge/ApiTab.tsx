import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Copy, Zap } from "lucide-react";
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

interface ApiTabProps {
    projectId?: string;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

const methodColors: Record<Method, string> = {
    GET: "bg-emerald-500/15 text-emerald-600",
    POST: "bg-blue-500/15 text-blue-600",
    PUT: "bg-amber-500/15 text-amber-600",
    DELETE: "bg-destructive/15 text-destructive",
};

function exampleValue(type: string): unknown {
    switch (type.toLowerCase()) {
        case "int":
            return 0;
        case "double":
            return 0.0;
        case "bool":
            return true;
        case "guid":
            return "00000000-0000-0000-0000-000000000000";
        default:
            return "string";
    }
}

function buildExampleBody(fields: { name: string; type: string }[]) {
    return {
        recordFields: fields.map((field) => ({
            name: field.name,
            value: exampleValue(field.type),
        })),
    };
}

export default function ApiTab({ projectId }: ApiTabProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
    const apiOrigin = apiBase || window.location.origin;

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

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Failed to copy");
        }
    };

    const endpoints = (resource: Resource) => {
        const base = `/api/projects/${projectId}/${resource.name}`;
        return [
            {
                method: "GET" as Method,
                path: base,
                description: "List records (?page, ?pageSize, ?sort, ?order, ?field=value)",
            },
            {
                method: "POST" as Method,
                path: base,
                description: "Create a record",
                body: buildExampleBody(resource.fields),
            },
            {
                method: "GET" as Method,
                path: `${base}/{id}`,
                description: "Get a record by id",
            },
            {
                method: "PUT" as Method,
                path: `${base}/{id}`,
                description: "Update a record",
                body: buildExampleBody(resource.fields),
            },
            {
                method: "DELETE" as Method,
                path: `${base}/{id}`,
                description: "Delete a record",
            },
        ];
    };

    if (!projectId) {
        return (
            <TabsContent value="api" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Zap className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Select a project to view its generated API.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    if (loading) {
        return (
            <TabsContent value="api" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Zap className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Loading API...</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    if (resources.length === 0) {
        return (
            <TabsContent value="api" className="mt-4">
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Zap className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No API yet. Create a resource to generate endpoints.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        );
    }

    return (
        <TabsContent value="api" className="mt-4">
            <p className="mb-3 text-xs text-muted-foreground">
                Generated endpoints are served from{" "}
                <span className="font-mono">{apiOrigin}/api/projects/{"{projectId}"}/{"{model}"}</span> and
                require authentication (your session cookie).
            </p>
            <div className="space-y-4">
                {resources.map((resource) => (
                    <Card key={resource.id} className="overflow-hidden">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 font-mono text-lg">
                                <Zap className="h-4 w-4 text-primary" />/{resource.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {endpoints(resource).map((endpoint) => {
                                const curl = endpoint.body
                                    ? `curl -X ${endpoint.method} '${apiOrigin}${endpoint.path}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(endpoint.body)}'`
                                    : `curl -X ${endpoint.method} '${apiOrigin}${endpoint.path}'`;

                                return (
                                    <div
                                        key={`${endpoint.method} ${endpoint.path}`}
                                        className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Badge variant="secondary" className={methodColors[endpoint.method]}>
                                                {endpoint.method}
                                            </Badge>
                                            <span className="truncate font-mono text-sm font-medium">
                                                {endpoint.path}
                                            </span>
                                            <span className="hidden text-xs text-muted-foreground sm:inline">
                                                {endpoint.description}
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => copy(curl)}
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </TabsContent>
    );
}
