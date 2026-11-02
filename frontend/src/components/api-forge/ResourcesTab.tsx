import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
interface ApiResource {
    id: string;
    name: string;
    project_id: string;
    created_at: string;
}

interface ApiField {
    id: string;
    name: string;
    data_type: FieldType;
    resource_id: string;
}

interface ApiFieldResponse {
    Id?: string;
    Name?: string;
    Type?: FieldType;
    id?: string;
    name?: string;
    type?: FieldType;
}

interface ApiResourceResponse {
    Id?: string;
    Name?: string;
    ProjectId?: string;
    Fields?: ApiFieldResponse[];
    id?: string;
    name?: string;
    projectId?: string;
    fields?: ApiFieldResponse[];
}

type FieldType = "string" | "int" | "double" | "bool" | "guid";

const fieldTypeColors: Record<string, string> = {
    string: "bg-accent text-accent-foreground",
    int: "bg-primary/10 text-primary",
    double: "bg-warning/10 text-warning",
    bool: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    guid: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const RESERVED_NAMES = ["definitions", "members", "invitations"];

const isReservedName = (name: string) =>
    RESERVED_NAMES.includes(name.trim().toLowerCase());

const isValidName = (name: string) =>
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(name.trim()) && !isReservedName(name);

const nameError = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed === "") return null;
    if (isReservedName(trimmed)) return `"${trimmed}" is a reserved name`;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed))
        return "Only letters, digits and underscores (no spaces)";
    return null;
};

interface ResourcesTabProps {
    projectId?: string;
    onChanged?: () => void;
}

export default function ResourcesTab({ projectId, onChanged }: ResourcesTabProps) {
    const [resources, setResources] = useState<ApiResource[]>([]);
    const [fields, setFields] = useState<Record<string, ApiField[]>>({});
    const [loading, setLoading] = useState(true);
    const [createResourceOpen, setCreateResourceOpen] = useState(false);
    const [newResourceName, setNewResourceName] = useState("");
    const [addFieldOpen, setAddFieldOpen] = useState(false);
    const [addFieldResourceId, setAddFieldResourceId] = useState<string | null>(null);
    const [addFieldName, setAddFieldName] = useState("");
    const [addFieldType, setAddFieldType] = useState<FieldType>("string");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTitle, setConfirmTitle] = useState("");
    const [confirmDescription, setConfirmDescription] = useState("");
    const [confirmLabel, setConfirmLabel] = useState("Confirm");
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

    const resourceNameError = nameError(newResourceName);

    const fieldNameError = nameError(addFieldName);

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
                setFields({});
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
                    setFields({});
                    return;
                }

                const data = (await response.json()) as ApiResourceResponse[];
                const mappedResources: ApiResource[] = (data ?? []).map((model) => ({
                    id: model.Id ?? model.id ?? "",
                    name: model.Name ?? model.name ?? "",
                    project_id: model.ProjectId ?? model.projectId ?? projectId,
                    created_at: "",
                }));

                const mappedFields: Record<string, ApiField[]> = {};
                for (const model of data ?? []) {
                    const modelId = model.Id ?? model.id ?? "";
                    const modelFields = model.Fields ?? model.fields ?? [];
                    mappedFields[modelId] = modelFields.map((field) => ({
                        id: field.Id ?? field.id ?? `${modelId}:${field.Name ?? field.name ?? "field"}`,
                        name: field.Name ?? field.name ?? "",
                        data_type: (field.Type ?? field.type ?? "string") as FieldType,
                        resource_id: modelId,
                    }));
                }

                setResources(mappedResources);
                setFields(mappedFields);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to load resources");
                setResources([]);
                setFields({});
            } finally {
                setLoading(false);
            }
        };

        fetchResources();
    }, [apiBase, projectId]);

    const handleCreateResource = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!projectId) return;
        const name = newResourceName.trim();
        if (!isValidName(name)) return;
        try {
            const response = await fetch(`${apiBase}/api/projects/${projectId}/definitions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name,
                    fields: [],
                }),
            });

            if (!response.ok) {
                toast.error(await parseErrorMessage(response));
                return;
            }

            const data = (await response.json()) as ApiResourceResponse;
            const resourceId = data.Id ?? data.id ?? "";
            const resource: ApiResource = {
                id: resourceId,
                name: data.Name ?? data.name ?? "",
                project_id: projectId ?? "",
                created_at: "",
            };
            const resourceFields: ApiField[] = (data.Fields ?? data.fields ?? []).map((field) => ({
                id: field.Id ?? field.id ?? `${resourceId}:${field.Name ?? field.name ?? "field"}`,
                name: field.Name ?? field.name ?? "",
                data_type: (field.Type ?? field.type ?? "string") as FieldType,
                resource_id: resourceId,
            }));

            setResources((prev) => [...prev, resource]);
            setFields((prev) => ({ ...prev, [resourceId]: resourceFields }));
            toast.success("Resource created");
            setCreateResourceOpen(false);
            setNewResourceName("");
            onChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create resource");
        }
    };
    const openAddFieldDialog = (resourceId: string) => {
        setAddFieldResourceId(resourceId);
        setAddFieldName("");
        setAddFieldType("string");
        setAddFieldOpen(true);
    };

    const handleAddField = async (resourceId: string, name: string, type: FieldType) => {
        if (!projectId) return;
        const trimmedName = name.trim();
        if (!trimmedName) return;
        if (!isValidName(trimmedName)) return;

        try {
            const response = await fetch(
                `${apiBase}/api/projects/${projectId}/definitions/${resourceId}/fields`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: trimmedName, type }),
                }
            );

            if (!response.ok) {
                toast.error(await parseErrorMessage(response));
                return;
            }

            const data = (await response.json()) as ApiFieldResponse;
            const newField: ApiField = {
                id: data.Id ?? data.id ?? `${resourceId}:${trimmedName}`,
                name: data.Name ?? data.name ?? trimmedName,
                data_type: (data.Type ?? data.type ?? type) as FieldType,
                resource_id: resourceId,
            };

            setFields((prev) => ({
                ...prev,
                [resourceId]: [...(prev[resourceId] || []), newField],
            }));
            toast.success("Field added");
            setAddFieldOpen(false);
            onChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to add field");
        }
    };

    const handleDeleteResource = async (resourceId: string) => {
        if (!projectId) return;

        try {
            const response = await fetch(`${apiBase}/api/projects/${projectId}/definitions/${resourceId}`, {
                method: "DELETE",
                credentials: "include",
            });

            if (!response.ok) {
                toast.error(await parseErrorMessage(response));
                return;
            }

            setResources((prev) => prev.filter((resource) => resource.id !== resourceId));
            setFields((prev) => {
                const next = { ...prev };
                delete next[resourceId];
                return next;
            });
            toast.success("Resource deleted");
            onChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete resource");
        }
    };

    const handleDeleteField = async (resourceId: string, fieldId: string) => {
        if (!projectId) return;

        try {
            const response = await fetch(
                `${apiBase}/api/projects/${projectId}/definitions/${resourceId}/fields/${fieldId}`,
                {
                    method: "DELETE",
                    credentials: "include",
                }
            );

            if (!response.ok) {
                toast.error(await parseErrorMessage(response));
                return;
            }

            setFields((prev) => ({
                ...prev,
                [resourceId]: (prev[resourceId] || []).filter((field) => field.id !== fieldId),
            }));
            toast.success("Field deleted");
            onChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete field");
        }
    };

    return (
        <TabsContent value="resources" className="mt-4">
            {projectId && (
                <div className="mb-4 flex items-center justify-end">
                    <Dialog open={createResourceOpen} onOpenChange={setCreateResourceOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                New Resource
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Resource</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateResource} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Resource Name</Label>
                                    <Input
                                        value={newResourceName}
                                        onChange={(event) => setNewResourceName(event.target.value)}
                                        placeholder="resource_name"
                                        required
                                        className="font-mono"
                                    />
                                    {resourceNameError && (
                                        <p className="text-xs text-destructive">{resourceNameError}</p>
                                    )}
                                </div>
                                <Button type="submit" className="w-full" disabled={!isValidName(newResourceName.trim())}>
                                    Create
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            {loading ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Zap className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">Loading resources...</p>
                    </CardContent>
                </Card>
            ) : resources.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Layers className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No resources yet. Create one to define your API.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {resources.map((resource) => (
                        <Card key={resource.id} className="overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg font-mono">
                                        <Zap className="h-4 w-4 text-primary" />/{resource.name}
                                    </CardTitle>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openAddFieldDialog(resource.id)}
                                        >
                                            <Plus className="mr-1 h-3.5 w-3.5" />
                                            Add Field
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => {
                                                setConfirmTitle(`Delete /${resource.name}?`);
                                                setConfirmDescription("This will permanently remove the resource.");
                                                setConfirmLabel("Delete");
                                                setConfirmAction(() => () => handleDeleteResource(resource.id));
                                                setConfirmOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(fields[resource.id] || []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No fields defined yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {(fields[resource.id] || []).map((field) => (
                                            <div
                                                key={field.id}
                                                className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-sm font-medium">{field.name}</span>
                                                    <Badge variant="secondary" className={fieldTypeColors[field.data_type]}>
                                                        {field.data_type}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => {
                                                        setConfirmTitle(`Delete field ${field.name}?`);
                                                        setConfirmDescription("This will permanently remove the field.");
                                                        setConfirmLabel("Delete");
                                                        setConfirmAction(() => () => handleDeleteField(resource.id, field.id));
                                                        setConfirmOpen(true);
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Field</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!addFieldResourceId) return;
                            handleAddField(addFieldResourceId, addFieldName, addFieldType);
                        }}
                        className="space-y-4"
                    >
                        <div className="space-y-2">
                            <Label>Field Name</Label>
                            <Input
                                value={addFieldName}
                                onChange={(event) => setAddFieldName(event.target.value)}
                                placeholder="field_name"
                                className="font-mono"
                                required
                            />
                            {fieldNameError && (
                                <p className="text-xs text-destructive">{fieldNameError}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Data Type</Label>
                            <Select value={addFieldType} onValueChange={(value) => setAddFieldType(value as FieldType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="string">string</SelectItem>
                                    <SelectItem value="int">int</SelectItem>
                                    <SelectItem value="double">double</SelectItem>
                                    <SelectItem value="bool">bool</SelectItem>
                                    <SelectItem value="guid">guid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full" disabled={!addFieldResourceId || !isValidName(addFieldName.trim())}>
                            Add Field
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={confirmOpen}
                title={confirmTitle}
                description={confirmDescription}
                confirmLabel={confirmLabel}
                confirmClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onConfirm={() => {
                    confirmAction?.();
                    setConfirmOpen(false);
                }}
                onOpenChange={setConfirmOpen}
            />
        </TabsContent>
    );
}
