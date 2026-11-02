import { ReactNode, useEffect, useRef, useState, MouseEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  FolderSymlink,
  FolderKanban,
  Zap,
  LogOut,
  User,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface ActiveProject {
  id: string;
  name: string;
}

const activeProjectsKey = "activeProjects";

const navItems = [
  { to: "/projects/owned", icon: FolderKanban, label: "My Projects" },
  { to: "/projects/member", icon: FolderSymlink, label: "Member Projects" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, isDemo } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [inviteCount, setInviteCount] = useState(0);
  const invitationIdsRef = useRef<Set<string>>(new Set());
  const invitesReadyRef = useRef(false);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

  useEffect(() => {
    let isMounted = true;

    const loadActiveProjects = async () => {
      const raw = localStorage.getItem(activeProjectsKey);
      let stored: ActiveProject[] = [];

      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ActiveProject[];
          stored = Array.isArray(parsed)
            ? parsed.filter((item) => item?.id && item?.name)
            : [];
        } catch {
          console.error("Failed to parse active projects from localStorage");
        }
      }

      // Prune projects that no longer exist (e.g. after a database reset).
      try {
        const response = await fetch(`${apiBase}/api/projects`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = (await response.json()) as { id?: string; Id?: string }[];
          const validIds = new Set(
            (data ?? []).map((p) => (p.id ?? p.Id ?? "").toLowerCase()),
          );
          const filtered = stored.filter((item) =>
            validIds.has(item.id.toLowerCase()),
          );

          if (isMounted) {
            setActiveProjects(filtered);
          }

          if (filtered.length === 0) {
            localStorage.removeItem(activeProjectsKey);
          } else if (filtered.length !== stored.length) {
            localStorage.setItem(activeProjectsKey, JSON.stringify(filtered));
          }
          return;
        }
      } catch {
        console.error("Failed to validate active projects against the server");
      }

      if (isMounted) {
        setActiveProjects(stored);
      }
    };

    loadActiveProjects();

    return () => {
      isMounted = false;
    };
  }, [apiBase, location.pathname]);

  useEffect(() => {
    if (!profile?.id) {
      invitationIdsRef.current = new Set();
      setInviteCount(0);
      invitesReadyRef.current = false;
      return;
    }

    let isMounted = true;

    const fetchInvitations = async () => {
      try {
        const response = await fetch(`${apiBase}/api/projects/invitations`, {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { id?: string }[];
        if (!isMounted) return;

        const nextIds = new Set(
          (data ?? []).map((item) => item?.id).filter(Boolean) as string[],
        );
        setInviteCount(nextIds.size);
        if (invitesReadyRef.current) {
          const newInvites = Array.from(nextIds).filter(
            (id) => !invitationIdsRef.current.has(id),
          );
          if (newInvites.length > 0) {
            toast.success(
              `You have ${newInvites.length} new invitation${newInvites.length > 1 ? "s" : ""}.`,
            );
          }
        }

        invitationIdsRef.current = nextIds;
        invitesReadyRef.current = true;
      } catch {
        console.error("Failed to fetch project invitations");
      }
    };

    fetchInvitations();
    const intervalId = setInterval(fetchInvitations, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [apiBase, profile?.id]);

  useEffect(() => {
    const handleInvitationUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ ids?: string[]; count?: number }>)
        .detail;
      if (detail?.ids) {
        const nextIds = new Set(detail.ids);
        invitationIdsRef.current = nextIds;
        setInviteCount(nextIds.size);
        invitesReadyRef.current = true;
        return;
      }

      if (typeof detail?.count === "number") {
        setInviteCount(detail.count);
        invitesReadyRef.current = true;
      }
    };

    window.addEventListener("invitations:updated", handleInvitationUpdate);
    return () =>
      window.removeEventListener("invitations:updated", handleInvitationUpdate);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleCloseProject = (
    event: MouseEvent<HTMLElement>,
    projectId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const updated = activeProjects.filter((item) => item.id !== projectId);
    if (updated.length === 0) {
      localStorage.removeItem(activeProjectsKey);
    } else {
      localStorage.setItem(activeProjectsKey, JSON.stringify(updated));
    }
    setActiveProjects(updated);
    if (location.pathname === `/api-forge/${projectId}`) {
      navigate("/projects/owned");
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-sidebar">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-sidebar-foreground">
            API Forge
          </span>
          <button
            type="button"
            aria-label="Toggle theme"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.to === "/projects/member" && inviteCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {inviteCount}
                </span>
              )}
            </NavLink>
          ))}

          {activeProjects.map((project) => (
            <NavLink
              key={project.id}
              to={`/api-forge/${project.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )
              }
            >
              <Zap className="h-4 w-4" />
              <span className="flex-1 truncate">{project.name}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label="Close project"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={(event) => handleCloseProject(event, project.id)}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
              )
            }
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium text-sidebar-foreground font-mono">
                {profile?.username || "—"}
              </p>
            </div>
          </NavLink>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start gap-3 text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {isDemo && (
          <div className="border-b border-border bg-amber-500/10 px-6 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            Demo mode — read-only. Changes are disabled.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
