import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Copy, Info, Zap } from "lucide-react";
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
    refreshKey?: number;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

const methodColors: Record<Method, string> = {
    GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    DELETE: "bg-destructive/15 text-destructive",
};

interface EndpointHelp {
    title: string;
    description: string;
    params?: { name: string; desc: string }[];
}

interface Endpoint {
    method: Method;
    path: string;
    body?: object;
    help: EndpointHelp;
}

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

export default function ApiTab({ projectId, refreshKey = 0 }: ApiTabProps) {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [devKey, setDevKey] = useState("");
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
    }, [apiBase, projectId, refreshKey]);

    useEffect(() => {
        const fetchDevKey = async () => {
            if (!projectId) {
                setDevKey("");
                return;
            }
            try {
                const response = await fetch(`${apiBase}/api/projects/${projectId}/dev-key`, {
                    credentials: "include",
                });
                if (response.ok) {
                    const data = await response.json();
                    setDevKey(data.key ?? "");
                }
            } catch {
                setDevKey("");
            }
        };

        fetchDevKey();
    }, [apiBase, projectId]);

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Failed to copy");
        }
    };

    const endpoints = (resource: Resource): Endpoint[] => {
        const base = `/api/projects/${projectId}/${resource.name}`;
        return [
            {
                method: "GET",
                path: base,
                help: {
                    title: "List records",
                    description: "Returns a paginated list of records for this resource.",
                    params: [
                        { name: "page", desc: "Page number (default: 1)" },
                        { name: "pageSize", desc: "Records per page (default: 20)" },
                        { name: "sort", desc: "Field name to sort by" },
                        { name: "order", desc: `"asc" or "desc" (default: "asc")` },
                        { name: "field=value", desc: "Filter: records where a field equals the value (repeatable)" },
                    ],
                },
            },
            {
                method: "GET",
                path: `${base}/{id}`,
                help: {
                    title: "Get a record by id",
                    description: "Returns a single record. Replace {id} with the record's id.",
                },
            },
            {
                method: "POST",
                path: base,
                body: buildExampleBody(resource.fields),
                help: {
                    title: "Create a record",
                    description:
                        "Creates a new record. The body is a recordFields array of { name, value } pairs — one entry per field.",
                },
            },
            {
                method: "PUT",
                path: `${base}/{id}`,
                body: buildExampleBody(resource.fields),
                help: {
                    title: "Update a record",
                    description:
                        "Updates an existing record. Replace {id} with the record's id and send the fields to change.",
                },
            },
            {
                method: "DELETE",
                path: `${base}/{id}`,
                help: {
                    title: "Delete a record",
                    description: "Deletes the record with the given id. Replace {id} with the record's id.",
                },
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
            <div className="mb-3 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                        Developer key (shared, changes daily)
                    </p>
                    <p className="truncate font-mono text-sm">{devKey || "—"}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(devKey)}
                    disabled={!devKey}
                >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                </Button>
            </div>

            <div className="mb-4 rounded-lg border p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">How to use</p>
                <ol className="list-inside list-decimal space-y-0.5">
                    <li>Copy the developer key above.</li>
                    <li>
                        Pick an endpoint below and press its copy button to get a ready{" "}
                        <code className="font-mono">curl</code> command.
                    </li>
                    <li>
                        Or call the URL directly and append{" "}
                        <code className="font-mono">?key={"{"}your-key{"}"}</code>.
                    </li>
                </ol>
            </div>

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
                                const keyQuery = devKey ? `?key=${devKey}` : "";
                                const curl = endpoint.body
                                    ? `curl -X ${endpoint.method} '${apiOrigin}${endpoint.path}${keyQuery}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(endpoint.body)}'`
                                    : `curl -X ${endpoint.method} '${apiOrigin}${endpoint.path}${keyQuery}'`;

                                return (
                                    <div
                                        key={`${endpoint.method} ${endpoint.path}`}
                                        className="rounded-lg border bg-muted/30"
                                    >
                                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <Badge variant="secondary" className={methodColors[endpoint.method]}>
                                                    {endpoint.method}
                                                </Badge>
                                                <span className="truncate font-mono text-sm font-medium">
                                                    {endpoint.path}
                                                </span>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                        >
                                                            <Info className="h-3.5 w-3.5" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" sideOffset={8} className="w-80 text-xs">
                                                        <p className="font-medium text-foreground">{endpoint.help.title}</p>
                                                        <p className="mt-1 text-muted-foreground">{endpoint.help.description}</p>
                                                        {endpoint.help.params && (
                                                            <div className="mt-2 space-y-1.5 border-t pt-2">
                                                                {endpoint.help.params.map((param) => (
                                                                    <div key={param.name}>
                                                                        <code className="font-mono text-foreground">{param.name}</code>
                                                                        <span className="text-muted-foreground"> — {param.desc}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </PopoverContent>
                                                </Popover>
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
                                        {endpoint.body && (
                                            <div className="border-t px-4 py-2">
                                                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                                                    Request body
                                                </p>
                                                <pre className="overflow-x-auto font-mono text-xs">
                                                    {JSON.stringify(endpoint.body, null, 2)}
                                                </pre>
                                            </div>
                                        )}
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
