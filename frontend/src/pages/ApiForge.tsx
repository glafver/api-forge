import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ApiTab, DataTab, ResourcesTab, SeedTab } from "@/components/api-forge";

interface Project {
  id: string;
  name: string;
  owner_id?: string;
  owner_username?: string;
}

const activeProjectsKey = "activeProjects";

export default function ApiForge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [resourcesRefreshKey, setResourcesRefreshKey] = useState(0);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

  const tabParam = searchParams.get("tab");
  const activeTab =
    tabParam === "data" || tabParam === "api" || tabParam === "seed"
      ? tabParam
      : "resources";

  const handleTabChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === "resources") {
        next.delete("tab");
      } else {
        next.set("tab", value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const notifyResourcesChanged = useCallback(
    () => setResourcesRefreshKey((key) => key + 1),
    [],
  );

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
    id?: string;
    name?: string;
    ownerId?: string;
    ownerUsername?: string;
  }): Project => ({
    id: data.Id ?? data.id ?? "",
    name: data.Name ?? data.name ?? "",
    owner_id: data.OwnerId ?? data.ownerId,
    owner_username: data.OwnerUsername ?? data.ownerUsername,
  });

  const getActiveProjects = useCallback((): Project[] => {
    const raw = localStorage.getItem(activeProjectsKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Project[];
      return Array.isArray(parsed)
        ? parsed.filter((item) => item?.id && item?.name)
        : [];
    } catch {
      return [];
    }
  }, []);

  const setActiveProjects = useCallback((next: Project[]) => {
    if (next.length === 0) {
      localStorage.removeItem(activeProjectsKey);
      return;
    }
    localStorage.setItem(activeProjectsKey, JSON.stringify(next));
  }, []);

  const upsertActiveProject = useCallback(
    (project: Project) => {
      const next = getActiveProjects();
      if (!next.some((item) => item.id === project.id)) {
        next.push({ id: project.id, name: project.name });
      }
      setActiveProjects(next);
    },
    [getActiveProjects, setActiveProjects],
  );

  const removeActiveProject = useCallback(
    (id?: string) => {
      if (!id) return;
      const next = getActiveProjects().filter((item) => item.id !== id);
      setActiveProjects(next);
    },
    [getActiveProjects, setActiveProjects],
  );

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
          removeActiveProject(projectId);
          navigate("/projects/owned", { replace: true });
          return;
        }

        const data = await response.json();
        const mapped = (data ?? []).map(mapProject);
        setProjects(mapped);

        if (!projectId) {
          navigate("/projects/owned", { replace: true });
          return;
        }

        const project = mapped.find((p) => p.id === projectId);
        if (!project) {
          toast.error("Project not found");
          removeActiveProject(projectId);
          navigate("/projects/owned", { replace: true });
          return;
        }

        upsertActiveProject(project);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load projects",
        );
        setProjects([]);
        removeActiveProject(projectId);
        navigate("/projects/owned", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [apiBase, navigate, projectId, removeActiveProject, upsertActiveProject]);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  const activeProject = projects.find((p) => p.id === projectId);
  const projectName = activeProject?.name ?? "";
  const showOwner =
    !!activeProject?.owner_id &&
    !!user?.id &&
    activeProject.owner_id !== user.id;
  const tabTriggerClass =
    "rounded-b-none text-xs border border-border bg-muted/10 px-5 py-2 font-semibold text-muted-foreground shadow-sm data-[state=active]:bg-white data-[state=active]:text-foreground";

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{projectName || "Project"}</h1>
            {showOwner ? (
              <p className="text-xs text-muted-foreground">
                Owner:{" "}
                {activeProject?.owner_username || activeProject?.owner_id}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                You are the owner of this project
              </p>
            )}
          </div>
        </div>

        {!projectId ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Database className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Select a project to manage APIs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="rounded-none inline-flex gap-2 border-b border-border bg-transparent p-0">
              <TabsTrigger value="resources" className={tabTriggerClass}>
                Resources
              </TabsTrigger>
              <TabsTrigger value="api" className={tabTriggerClass}>
                API
              </TabsTrigger>
              <TabsTrigger value="seed" className={tabTriggerClass}>
                Seed Data
              </TabsTrigger>
              <TabsTrigger value="data" className={tabTriggerClass}>
                Data
              </TabsTrigger>
            </TabsList>

            <ResourcesTab projectId={projectId} onChanged={notifyResourcesChanged} />

            <ApiTab projectId={projectId} refreshKey={resourcesRefreshKey} />
            <SeedTab projectId={projectId} refreshKey={resourcesRefreshKey} />
            <DataTab projectId={projectId} refreshKey={resourcesRefreshKey} active={activeTab === "data"} />
          </Tabs>
        )}
      </motion.div>
    </div>
  );
}
