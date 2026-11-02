import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useNavigate } from "react-router-dom";

export default function Profile() {
    const { profile, refreshProfile, signOut } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
    const tabTriggerClass =
        "rounded-b-none text-xs border border-border bg-muted/10 px-5 py-2 font-semibold text-muted-foreground shadow-sm data-[state=active]:bg-card data-[state=active]:text-foreground";

    useEffect(() => {
        setUsername(profile?.username ?? "");
        setEmail(profile?.email ?? "");
    }, [profile?.email, profile?.username]);

    const createdAtLabel = useMemo(() => {
        if (!profile?.created_at) return "—";
        const parsed = new Date(profile.created_at);
        if (Number.isNaN(parsed.getTime())) return profile.created_at;
        return parsed.toLocaleDateString();
    }, [profile?.created_at]);

    const readJsonIfPossible = async (response: Response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
            return null;
        }

        try {
            return await response.json();
        } catch {
            return null;
        }
    };

    const parseErrorMessage = async (response: Response) => {
        const data = await readJsonIfPossible(response);
        if (typeof data?.Message === "string") return data.Message;
        if (typeof data?.message === "string") return data.message;
        if (typeof data?.error === "string") return data.error;
        const fallbackText = await response.text().catch(() => "");
        return fallbackText || response.statusText || "Request failed";
    };

    const handleProfileSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSavingProfile(true);

        try {
            const response = await fetch(`${apiBase}/api/user`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    username: username.trim(),
                    email: email.trim(),
                }),
            });

            if (!response.ok) {
                toast.error(await parseErrorMessage(response));
                return;
            }

            toast.success("Profile updated");
            await refreshProfile();
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setSavingPassword(true);
        try {
            const response = await fetch(`${apiBase}/api/user/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            if (!response.ok) {
                toast.error(await parseErrorMessage(response));
                return;
            }

            toast.success("Password updated");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            await refreshProfile();
        } finally {
            setSavingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        setDeletingAccount(true);
        try {
            const response = await fetch(`${apiBase}/api/user/me`, {
                method: "DELETE",
                credentials: "include",
            });

            if (!response.ok) {
                toast.error(await parseErrorMessage(response));
                return;
            }

            toast.success("Account deleted");
            await signOut();
            navigate("/login", { replace: true });
        } finally {
            setDeletingAccount(false);
            setDeleteOpen(false);
        }
    };

    if (!profile) {
        return (
            <div className="p-8">
                <p className="text-muted-foreground">Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="mb-8">
                    <h1 className="text-2xl font-bold">Profile</h1>
                    <p className="text-muted-foreground">Manage your account details and password.</p>
                </div>

                <Tabs defaultValue="account" className="max-w-3xl">
                    <TabsList className="rounded-none inline-flex gap-2 border-b border-border bg-transparent p-0">
                        <TabsTrigger value="account" className={tabTriggerClass}>
                            Account Details
                        </TabsTrigger>
                        <TabsTrigger value="password" className={tabTriggerClass}>
                            Change Password
                        </TabsTrigger>
                        <TabsTrigger value="danger" className={tabTriggerClass}>
                            Delete Account
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="account" className="mt-4">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Account Details</CardTitle>
                                <CardDescription>Update your username and email address.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleProfileSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="username">Username</Label>
                                        <Input
                                            id="username"
                                            value={username}
                                            onChange={(event) => setUsername(event.target.value)}
                                            required
                                            className="font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-2 text-sm text-muted-foreground">
                                        <div className="flex items-center justify-between">
                                            <span>Joined</span>
                                            <span className="text-foreground">{createdAtLabel}</span>
                                        </div>
                                    </div>
                                    <Button type="submit" disabled={savingProfile} className="w-full">
                                        {savingProfile ? "Saving..." : "Save Changes"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="password" className="mt-4">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Change Password</CardTitle>
                                <CardDescription>Use a strong password you do not reuse elsewhere.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="currentPassword">Current Password</Label>
                                        <Input
                                            id="currentPassword"
                                            type="password"
                                            value={currentPassword}
                                            onChange={(event) => setCurrentPassword(event.target.value)}
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">New Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="newPassword"
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(event) => setNewPassword(event.target.value)}
                                                placeholder="••••••••"
                                                required
                                                className="pr-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1 top-1 h-8 w-8"
                                                onClick={() => setShowNewPassword((value) => !value)}
                                                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                                            >
                                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                        <div className="relative">
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(event) => setConfirmPassword(event.target.value)}
                                                placeholder="••••••••"
                                                required
                                                className="pr-10"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1 top-1 h-8 w-8"
                                                onClick={() => setShowConfirmPassword((value) => !value)}
                                                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                                            >
                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <Button type="submit" disabled={savingPassword} className="w-full">
                                        {savingPassword ? "Updating..." : "Update Password"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="danger" className="mt-4">
                        <Card className="h-full border-destructive/30">
                            <CardHeader>
                                <CardTitle>Delete Account</CardTitle>
                                <CardDescription>
                                    This will delete your owned projects and remove you from all member projects.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-destructive">This action cannot be undone.</p>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setDeleteOpen(true)}
                                        disabled={deletingAccount}
                                    >
                                        {deletingAccount ? "Deleting..." : "Delete Account"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </motion.div>
            <ConfirmDialog
                open={deleteOpen}
                title="Delete your account?"
                description="This will delete your owned projects and remove you from all member projects. This action cannot be undone."
                confirmLabel="Delete"
                confirmClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onConfirm={handleDeleteAccount}
                onOpenChange={setDeleteOpen}
            />
        </div>
    );
}
