import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Pencil, Trash2, Users, Zap } from "lucide-react";

interface Project {
    id: string;
    name: string;
    owner_id: string;
    owner_username: string;
    created_at: string;
}

interface ProjectCardProps {
    project: Project;
    canEdit: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onMembers: () => void;
    onApis: () => void;
    onLeave?: () => void;
    ownerLabel?: string;
}

export default function ProjectCard({
    project,
    canEdit,
    onEdit,
    onDelete,
    onMembers,
    onApis,
    onLeave,
    ownerLabel,
}: ProjectCardProps) {

    return (
        <Card key={project.id} className="group transition-colors hover:border-primary/30">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <div className="flex items-center gap-2">
                        {onLeave && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={onLeave}
                            >
                                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                                Leave
                            </Button>
                        )}
                        {canEdit && (
                            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={onEdit}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={onDelete}
                                >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
                <CardDescription>
                    Created {new Date(project.created_at).toLocaleDateString()}
                </CardDescription>
                {ownerLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">Owner: {ownerLabel}</p>
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={onMembers}>
                        <Users className="mr-1.5 h-3.5 w-3.5" />
                        Members
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/50 text-primary hover:border-primary hover:text-primary w-[120px]"
                        onClick={onApis}
                    >
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        API Forge
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
