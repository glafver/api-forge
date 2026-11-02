import { useState, useEffect } from "react";
import { motion } from "framer-motion";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import EditProjectDialog from "@/components/EditProjectDialog";
import ProjectMembersDialog from "@/components/ProjectMembersDialog";
import CreateProjectDialog from "@/components/CreateProjectDialog";
import ProjectCard from "@/components/ProjectCard";
import ConfirmDialog from "@/components/ConfirmDialog";

export type ProjectsView = "owned" | "member";

interface Project {
  id: string;
  name: string;
  owner_id: string;
  owner_username: string;
  created_at: string;
}

interface Member {
  id: string;
  user_id: string;
  username: string;
  email: string;
}

interface Invitation {
  id: string;
  project_id: string;
  project_name: string;
  email: string;
  invited_by: string;
  created_at: string;
}

interface UserSuggestion {
  id: string;
  username: string;
  email: string;
}

export default function Projects({ view = "owned" }: { view?: ProjectsView }) {
  const { profile: user, isDemo } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [membersProject, setMembersProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [projectInvitations, setProjectInvitations] = useState<Invitation[]>(
    [],
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteSuggestions, setInviteSuggestions] = useState<UserSuggestion[]>(
    [],
  );
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSearchPaused, setInviteSearchPaused] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmLabel, setConfirmLabel] = useState("Confirm");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

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

  const mapProject = (data: {
    Id?: string;
    Name?: string;
    OwnerId?: string;
    OwnerUsername?: string;
    CreatedAt?: string;
    id?: string;
    name?: string;
    ownerId?: string;
    ownerUsername?: string;
    createdAt?: string;
  }): Project => ({
    id: data.Id ?? data.id ?? "",
    name: data.Name ?? data.name ?? "",
    owner_id: data.OwnerId ?? data.ownerId ?? "",
    owner_username: data.OwnerUsername ?? data.ownerUsername ?? "",
    created_at: data.CreatedAt ?? data.createdAt ?? "",
  });

  const mapMember = (data: {
    Id?: string;
    UserId?: string;
    Username?: string;
    Email?: string;
    id?: string;
    userId?: string;
    username?: string;
    email?: string;
  }): Member => ({
    id: data.Id ?? data.id ?? "",
    user_id: data.UserId ?? data.userId ?? "",
    username: data.Username ?? data.username ?? "",
    email: data.Email ?? data.email ?? "",
  });

  const mapInvitation = (data: {
    Id?: string;
    ProjectId?: string;
    ProjectName?: string;
    Email?: string;
    InvitedByUsername?: string;
    CreatedAt?: string;
    id?: string;
    projectId?: string;
    projectName?: string;
    email?: string;
    invitedByUsername?: string;
    createdAt?: string;
  }): Invitation => ({
    id: data.Id ?? data.id ?? "",
    project_id: data.ProjectId ?? data.projectId ?? "",
    project_name: data.ProjectName ?? data.projectName ?? "",
    email: data.Email ?? data.email ?? "",
    invited_by: data.InvitedByUsername ?? data.invitedByUsername ?? "",
    created_at: data.CreatedAt ?? data.createdAt ?? "",
  });

  const mapUserSuggestion = (data: {
    Id?: string;
    Username?: string;
    Email?: string;
    id?: string;
    username?: string;
    email?: string;
  }): UserSuggestion => ({
    id: data.Id ?? data.id ?? "",
    username: data.Username ?? data.username ?? "",
    email: data.Email ?? data.email ?? "",
  });

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiBase}/api/projects`, {
          credentials: "include",
        });

        if (!response.ok) {
          toast.error(await parseErrorMessage(response));
          setProjects([]);
          return;
        }

        const data = await response.json();
        setProjects((data ?? []).map(mapProject));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load projects",
        );
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [apiBase]);

  useEffect(() => {
    const fetchInvitations = async () => {
      if (!user) {
        setInvitations([]);
        return;
      }

      try {
        const response = await fetch(`${apiBase}/api/projects/invitations`, {
          credentials: "include",
        });

        if (!response.ok) {
          toast.error(await parseErrorMessage(response));
          setInvitations([]);
          return;
        }

        const data = await response.json();
        setInvitations((data ?? []).map(mapInvitation));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load invitations",
        );
        setInvitations([]);
      }
    };

    fetchInvitations();
  }, [apiBase, user]);

  useEffect(() => {
    const query = inviteEmail.trim();
    if (
      inviteSearchPaused ||
      !membersProject ||
      !canManageMembers ||
      query.length < 2
    ) {
      setInviteSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setInviteLoading(true);
      try {
        const response = await fetch(
          `${apiBase}/api/user/search?query=${encodeURIComponent(query)}&limit=6`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setInviteSuggestions([]);
          return;
        }

        const data = await response.json();
        setInviteSuggestions((data ?? []).map(mapUserSuggestion));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setInviteSuggestions([]);
        }
      } finally {
        setInviteLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [apiBase, inviteEmail, membersProject, inviteSearchPaused]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const response = await fetch(`${apiBase}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      const data = await response.json();
      const project = mapProject(data);
      setProjects((prev) => [...prev, project]);
      toast.success("Project created");
      setCreateOpen(false);
      setNewName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project",
      );
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProject) return;
    try {
      const response = await fetch(
        `${apiBase}/api/projects/${editProject.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: editName }),
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      const data = await response.json();
      const project = mapProject(data);
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? project : p)),
      );
      toast.success("Project updated");
      setEditProject(null);
      setEditName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update project",
      );
    }
  };

  const handleDelete = async (project: Project) => {
    try {
      const response = await fetch(`${apiBase}/api/projects/${project.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success("Project deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project",
      );
    }
  };

  const fetchMembers = async (projectId: string) => {
    try {
      const response = await fetch(
        `${apiBase}/api/projects/${projectId}/members`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      const data = await response.json();
      const mapped = (data ?? []).map(mapMember);
      const currentUserId = user?.id;
      if (currentUserId) {
        mapped.sort((a, b) => {
          if (a.user_id === currentUserId && b.user_id !== currentUserId)
            return -1;
          if (a.user_id !== currentUserId && b.user_id === currentUserId)
            return 1;
          return a.username.localeCompare(b.username);
        });
      }
      setMembers(mapped);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load members",
      );
    }
  };

  const fetchProjectInvitations = async (projectId: string) => {
    try {
      const response = await fetch(
        `${apiBase}/api/projects/${projectId}/invitations`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        setProjectInvitations([]);
        return;
      }

      const data = await response.json();
      setProjectInvitations((data ?? []).map(mapInvitation));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load invitations",
      );
      setProjectInvitations([]);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membersProject) return;
    if (user?.id !== membersProject.owner_id) {
      toast.error("Only the project owner can invite members");
      return;
    }
    try {
      const response = await fetch(
        `${apiBase}/api/projects/${membersProject.id}/invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: inviteEmail }),
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      const data = await response.json();
      const invitation = mapInvitation(data);
      setProjectInvitations((prev) => [invitation, ...prev]);
      toast.success("Invitation sent");
      setInviteEmail("");
      setInviteSuggestions([]);
      setInviteSearchPaused(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send invitation",
      );
    }
  };

  const handleInviteEmailChange = (value: string) => {
    setInviteSearchPaused(false);
    setInviteEmail(value);
  };

  const handleSelectSuggestion = (suggestion: UserSuggestion) => {
    setInviteSearchPaused(true);
    setInviteEmail(suggestion.email);
    setInviteSuggestions([]);
    setInviteLoading(false);
  };

  const handleCancelInvitation = async (invitation: Invitation) => {
    if (!membersProject) return;
    try {
      const response = await fetch(
        `${apiBase}/api/projects/${membersProject.id}/invitations/${invitation.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      setProjectInvitations((prev) =>
        prev.filter((item) => item.id !== invitation.id),
      );
      toast.success("Invitation removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove invitation",
      );
    }
  };

  const handleAcceptInvitation = async (invitation: Invitation) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${apiBase}/api/projects/invitations/${invitation.id}/accept`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      setInvitations((prev) => {
        const next = prev.filter((item) => item.id !== invitation.id);
        window.dispatchEvent(
          new CustomEvent("invitations:updated", {
            detail: {
              ids: next.map((item) => item.id),
            },
          }),
        );
        return next;
      });
      toast.success("Invitation accepted");
      const projectsResponse = await fetch(`${apiBase}/api/projects`, {
        credentials: "include",
      });
      if (projectsResponse.ok) {
        const data = await projectsResponse.json();
        setProjects((data ?? []).map(mapProject));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept invitation",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitation: Invitation) => {
    try {
      const response = await fetch(
        `${apiBase}/api/projects/invitations/${invitation.id}/decline`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      setInvitations((prev) => {
        const next = prev.filter((item) => item.id !== invitation.id);
        window.dispatchEvent(
          new CustomEvent("invitations:updated", {
            detail: {
              ids: next.map((item) => item.id),
            },
          }),
        );
        return next;
      });
      toast.success("Invitation declined");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to decline invitation",
      );
    }
  };

  const handleRemoveMember = async (member: Member) => {
    if (!membersProject) return;
    if (user?.id !== membersProject.owner_id) {
      toast.error("Only the project owner can remove members");
      return;
    }
    if (user?.id === member.user_id) {
      toast.error("You cannot remove yourself from the project");
      return;
    }
    try {
      const response = await fetch(
        `${apiBase}/api/projects/${membersProject.id}/members/${member.user_id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      toast.success("Member removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member",
      );
    }
  };

  const handleLeaveProject = async (project: Project) => {
    if (!user) return;
    try {
      const response = await fetch(
        `${apiBase}/api/projects/${project.id}/members/${user.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        toast.error(await parseErrorMessage(response));
        return;
      }

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      if (membersProject?.id === project.id) {
        setMembersProject(null);
        setMembers([]);
      }
      toast.success("Left project");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to leave project",
      );
    }
  };

  const ownedProjects = user
    ? projects.filter((project) => project.owner_id === user.id)
    : [];
  const memberProjects = user
    ? projects.filter((project) => project.owner_id !== user.id)
    : [];

  const visibleOwned = view === "member" ? [] : ownedProjects;
  const visibleMembers = view === "owned" ? [] : memberProjects;
  const canManageMembers =
    user?.id === membersProject?.owner_id && view !== "member";

  const openEditProject = (project: Project) => {
    setEditProject(project);
    setEditName(project.name);
  };

  const closeEditProject = () => {
    setEditProject(null);
  };

  const openMembersProject = (project: Project) => {
    setMembersProject(project);
    fetchMembers(project.id);
    if (user?.id === project.owner_id) {
      fetchProjectInvitations(project.id);
    } else {
      setProjectInvitations([]);
    }
  };

  const closeMembersProject = () => {
    setMembersProject(null);
    setProjectInvitations([]);
  };

  const openApis = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (project) {
      try {
        const raw = localStorage.getItem("activeProjects");
        const parsed = raw
          ? (JSON.parse(raw) as { id: string; name: string }[])
          : [];
        const next = Array.isArray(parsed)
          ? parsed.filter((item) => item?.id && item?.name)
          : [];
        if (!next.some((item) => item.id === project.id)) {
          next.push({ id: project.id, name: project.name });
        }
        localStorage.setItem("activeProjects", JSON.stringify(next));
      } catch {
        localStorage.removeItem("activeProjects");
      }
    }
    navigate(`/api-forge/${projectId}`);
  };

  const canEditProject = (project: Project) => {
    return !isDemo && view !== "member" && user?.id === project.owner_id;
  };

  const openConfirm = (
    title: string,
    description: string,
    label: string,
    action: () => void,
  ) => {
    setConfirmTitle(title);
    setConfirmDescription(description);
    setConfirmLabel(label);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };
  const tabTriggerClass =
    "rounded-b-none text-xs border border-border bg-muted/10 px-5 py-2 font-semibold text-muted-foreground shadow-sm data-[state=active]:bg-card data-[state=active]:text-foreground";

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold" style={{ height: "40px" }}>
              Projects
            </h1>
          </div>
          {view !== "member" && !isDemo && (
            <CreateProjectDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              name={newName}
              onNameChange={setNewName}
              onSubmit={handleCreate}
            />
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : view === "member" ? (
          <Tabs defaultValue="projects">
            <TabsList className="rounded-none inline-flex gap-2 border-b border-border bg-transparent p-0">
              <TabsTrigger value="projects" className={tabTriggerClass}>
                Member Projects
              </TabsTrigger>
              <TabsTrigger value="invitations" className={tabTriggerClass}>
                <span className="flex items-center gap-2">
                  Invitations
                  {invitations.length > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground">
                      {invitations.length}
                    </span>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invitations" className="mt-4">
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No invitations right now.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {invitations.map((invite) => (
                    <Card
                      key={invite.id}
                      className="group h-full transition-colors hover:border-primary/30"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">
                          {invite.project_name}
                        </CardTitle>
                        <CardDescription>
                          Invited by {invite.invited_by || "Project owner"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="mt-auto flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleDeclineInvitation(invite)}
                        >
                          Decline
                        </Button>
                        <Button onClick={() => handleAcceptInvitation(invite)}>
                          Accept
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="projects" className="mt-4">
              {visibleMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You are not a member of any projects yet.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {visibleMembers.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      canEdit={canEditProject(project)}
                      onEdit={() => openEditProject(project)}
                      onDelete={() =>
                        openConfirm(
                          `Delete project "${project.name}"?`,
                          "This will permanently remove the project.",
                          "Delete",
                          () => handleDelete(project),
                        )
                      }
                      onMembers={() => openMembersProject(project)}
                      onApis={() => openApis(project.id)}
                      onLeave={() =>
                        openConfirm(
                          `Leave project "${project.name}"?`,
                          "You will lose access to this project.",
                          "Leave",
                          () => handleLeaveProject(project),
                        )
                      }
                      ownerLabel={project.owner_username || project.owner_id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No projects yet. Create one to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">My Projects</h2>
            {visibleOwned.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You do not own any projects yet.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleOwned.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    canEdit={canEditProject(project)}
                    onEdit={() => openEditProject(project)}
                    onDelete={() =>
                      openConfirm(
                        `Delete project "${project.name}"?`,
                        "This will permanently remove the project.",
                        "Delete",
                        () => handleDelete(project),
                      )
                    }
                    onMembers={() => openMembersProject(project)}
                    onApis={() => openApis(project.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <EditProjectDialog
          open={!!editProject}
          name={editName}
          onNameChange={setEditName}
          onOpenChange={(open) => !open && closeEditProject()}
          onSubmit={handleEdit}
        />

        <ProjectMembersDialog
          open={!!membersProject}
          projectName={membersProject?.name}
          members={members}
          invitations={projectInvitations}
          inviteEmail={inviteEmail}
          inviteSuggestions={inviteSuggestions}
          inviteLoading={inviteLoading}
          canManageMembers={canManageMembers}
          currentUserId={user?.id}
          onInviteEmailChange={handleInviteEmailChange}
          onInvite={handleInvite}
          onSelectSuggestion={handleSelectSuggestion}
          onCancelInvitation={handleCancelInvitation}
          onRemoveMember={handleRemoveMember}
          onOpenChange={(open) => !open && closeMembersProject()}
        />
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
      </motion.div>
    </div>
  );
}
