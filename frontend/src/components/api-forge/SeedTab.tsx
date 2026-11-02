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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Database, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
    active?: boolean;
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

const FIRST_NAMES = [
    "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry",
    "Ivy", "Jack", "Karen", "Leo", "Mia", "Noah", "Olivia", "Peter",
];
const LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Martin",
];
const PRODUCTS = [
    "Wireless Mouse", "Mechanical Keyboard", "USB-C Charger", "Bluetooth Speaker",
    "4K Monitor", "Noise-Cancelling Headphones", "Smart Watch", "Webcam",
];
const CITIES = [
    "New York", "London", "Berlin", "Tokyo", "Paris", "Sydney", "Toronto",
    "Amsterdam", "Madrid", "Rome",
];
const COUNTRIES = [
    "USA", "Germany", "Japan", "France", "Canada", "Australia", "Spain", "Italy",
];
const COLORS = ["Red", "Blue", "Green", "Black", "White", "Yellow", "Purple", "Orange"];

const SMART_PATTERNS: { field: string; example: string }[] = [
    { field: "id, *_id, uuid, guid", example: "3f2b9c… (UUID)" },
    { field: "email, mail", example: "alice.smith42@example.com" },
    { field: "phone, mobile, tel", example: "+1-555-0184" },
    { field: "first_name, firstname", example: "Alice" },
    { field: "last_name, surname", example: "Smith" },
    { field: "name, full_name", example: "Alice Smith" },
    { field: "username, login, nickname", example: "alice42" },
    { field: "price, cost, amount, total, salary", example: "327.64" },
    { field: "product, item, title, goods", example: "Mechanical Keyboard" },
    { field: "quantity, qty, count, stock", example: "42" },
    { field: "age", example: "25" },
    { field: "number, num, no", example: "4821" },
    { field: "date, created, updated, birthday, born", example: "2026-04-15" },
    { field: "url, website, site, link", example: "https://example.com/abc123" },
    { field: "city, town", example: "Berlin" },
    { field: "country", example: "Germany" },
    { field: "address, street", example: "123 Smith St." },
    { field: "zip, postal, postcode", example: "48210" },
    { field: "color, colour", example: "Purple" },
];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function isValidForType(value: string, type: string): boolean {
    switch (type.toLowerCase()) {
        case "int":
            return /^-?\d+$/.test(value);
        case "double":
            return /^-?\d+(\.\d+)?$/.test(value);
        case "bool":
            return value === "true" || value === "false";
        case "guid":
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        default:
            return true; // string accepts anything
    }
}

function smartValue(name: string, type: string): string {
    const n = name.toLowerCase();
    const t = type.toLowerCase();

    const candidate = (() => {
        // IDs / UUIDs
        if (n === "id" || n.endsWith("_id") || n.includes("uuid") || n.includes("guid")) {
            return crypto.randomUUID();
        }

        // Contact info
        if (n.includes("email") || n.includes("mail")) {
            return `${pick(FIRST_NAMES).toLowerCase()}.${pick(LAST_NAMES).toLowerCase()}${Math.floor(Math.random() * 90) + 10}@example.com`;
        }
        if (n.includes("phone") || n.includes("mobile") || n.includes("tel")) {
            return t === "int" || t === "double"
                ? String(Math.floor(Math.random() * 900000000) + 100000000)
                : `+1-555-01${Math.floor(Math.random() * 90) + 10}`;
        }

        // Names
        if (n.includes("first_name") || n.includes("firstname")) return pick(FIRST_NAMES);
        if (n.includes("last_name") || n.includes("lastname") || n.includes("surname")) return pick(LAST_NAMES);
        if (n === "name" || n.includes("full_name") || n.includes("fullname")) {
            return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        }
        if (n.includes("username") || n.includes("login") || n.includes("nickname")) {
            return `${pick(FIRST_NAMES).toLowerCase()}${Math.floor(Math.random() * 90) + 10}`;
        }

        // Money
        if (n.includes("price") || n.includes("cost") || n.includes("amount") || n.includes("total") || n.includes("salary")) {
            const value = Math.random() * 1000;
            return t === "int" ? String(Math.round(value)) : value.toFixed(2);
        }

        // Products / items
        if (n.includes("product") || n.includes("item") || n.includes("title") || n.includes("goods")) {
            return pick(PRODUCTS);
        }

        // Counts and numbers
        if (n.includes("quantity") || n.includes("qty") || n === "count" || n.endsWith("_count") || n.includes("stock")) {
            return String(Math.floor(Math.random() * 100) + 1);
        }
        if (n === "age") return String(Math.floor(Math.random() * 60) + 18);
        if (n.includes("number") || n.includes("num") || n === "no") {
            return String(Math.floor(Math.random() * 9000) + 1000);
        }

        // Dates
        if (n.includes("date") || n.includes("created") || n.includes("updated") || n.includes("birthday") || n.includes("born")) {
            const d = new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 3600 * 1000));
            return d.toISOString().slice(0, 10);
        }

        // Web
        if (n.includes("url") || n.includes("website") || n.includes("site") || n.includes("link")) {
            return `https://example.com/${Math.random().toString(36).slice(2, 8)}`;
        }

        // Location
        if (n.includes("city") || n.includes("town")) return pick(CITIES);
        if (n.includes("country")) return pick(COUNTRIES);
        if (n.includes("address") || n.includes("street")) return `${Math.floor(Math.random() * 999) + 1} ${pick(LAST_NAMES)} St.`;
        if (n.includes("zip") || n.includes("postal") || n.includes("postcode")) return String(Math.floor(Math.random() * 90000) + 10000);

        // Misc
        if (n.includes("color") || n.includes("colour")) return pick(COLORS);

        return null;
    })();

    if (candidate !== null && isValidForType(candidate, t)) {
        return candidate;
    }

    // Fall back to type-based random value
    return randomValue(type);
}

export default function SeedTab({ projectId, refreshKey = 0, active = true }: SeedTabProps) {
    const { isDemo } = useAuth();
    const [resources, setResources] = useState<Resource[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [existingCounts, setExistingCounts] = useState<Record<string, number>>({});
    const [selected, setSelected] = useState<Record<string, Set<string>>>({});
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState<Record<string, boolean>>({});
    const [prompt, setPrompt] = useState<Resource | null>(null);
    const [guideOpen, setGuideOpen] = useState(false);
    const [reload, setReload] = useState(0);
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
                            `${apiBase}/api/projects/${projectId}/${resource.name}?page=1&pageSize=100`,
                            { credentials: "include" },
                        );
                        if (recResp.ok) {
                            const recData = await recResp.json();
                            const items = (recData.items ?? []) as {
                                fields?: { name: string; value: string }[];
                            }[];
                            initialExisting[resource.id] = recData.totalCount ?? items.length;

                            // Pre-select only fields that have no value yet in existing records.
                            if (items.length > 0) {
                                const filledFields = new Set<string>();
                                for (const item of items) {
                                    for (const field of item.fields ?? []) {
                                        if (field.value !== "" && !field.value.startsWith("sample_")) {
                                            filledFields.add(field.name);
                                        }
                                    }
                                }
                                initialSelected[resource.id] = new Set(
                                    resource.fields
                                        .map((field) => field.name)
                                        .filter((name) => !filledFields.has(name)),
                                );
                            }
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

        if (active) {
            fetchResources();
        }
    }, [active, apiBase, projectId, refreshKey, reload]);

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
        setSeeding((prev) => ({ ...prev, [resource.id]: true }));

        try {
            let created = 0;
            for (let i = 0; i < count; i++) {
                const body = {
                    recordFields: resource.fields.map((field) => ({
                        name: field.name,
                        value: smartValue(field.name, field.type),
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
            setReload((key) => key + 1);
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
                    if (selectedFields.has(field.name) && (value === "" || value.startsWith("sample_"))) {
                        value = smartValue(field.name, field.type);
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
            setReload((key) => key + 1);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to fill records");
        } finally {
            setSeeding((prev) => ({ ...prev, [resource.id]: false }));
        }
    };

    const handleGenerate = (resource: Resource) => {
        const selectedFields = selected[resource.id] ?? new Set();
        if (selectedFields.size > 0 && (existingCounts[resource.id] ?? 0) > 0) {
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
            <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Field names are detected to generate realistic values.
                </p>
                <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}>
                    <Info className="mr-1 h-3.5 w-3.5" />
                    Smart filling
                </Button>
            </div>

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
                                            Fields to fill
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
                                            Only checked fields will be filled.
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
                                        {!isDemo && (
                                        <Button
                                            onClick={() => handleGenerate(resource)}
                                            disabled={seeding[resource.id]}
                                        >
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            {seeding[resource.id] ? "Working..." : "Generate"}
                                        </Button>
                                        )}
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
                            {(prompt ? existingCounts[prompt.id] ?? 0 : 0) === 1 ? "" : "s"}.
                            Fill empty fields in existing records (for a newly added field), or create new
                            records.
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
                            <Sparkles className="mr-2 h-4 w-4" />
                            Fill missing values in existing records
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                const resource = prompt;
                                setPrompt(null);
                                if (resource) seedNew(resource);
                            }}
                        >
                            Create new records
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Smart filling patterns</DialogTitle>
                        <DialogDescription>
                            If a field name matches one of these, a realistic value is generated.
                            Otherwise a generic value based on the field type is used.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="font-mono text-xs">Field name</TableHead>
                                    <TableHead className="text-xs">Example value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {SMART_PATTERNS.map((pattern) => (
                                    <TableRow key={pattern.field}>
                                        <TableCell className="font-mono text-xs">{pattern.field}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {pattern.example}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </TabsContent>
    );
}
