import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPlus } from "lucide-react";

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    name: string;
    onNameChange: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
    disabled?: boolean;
}

export default function CreateProjectDialog({
    open,
    onOpenChange,
    name,
    onNameChange,
    onSubmit,
    disabled,
}: CreateProjectDialogProps) {

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button disabled={disabled}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    New Project
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Project Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            required
                            placeholder="My Project"
                        />
                    </div>
                    <Button type="submit" className="w-full">
                        Create
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
