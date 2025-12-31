"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Edge, Node } from "reactflow";
import {
  Code2,
  GitGraph,
  Network,
  Share2,
  Menu,
  LayoutTemplate,
  Settings,
  Download,
  Copy,
  Check,
  FolderPlus,
  Save,
  Lock,
  Unlock,
  Link as LinkIcon,
  ArrowRight,
  AlertCircle,
  UploadCloud,
  X
} from "lucide-react";

import { getJsonParseError } from "@/lib/json-error";

import type { ShareLinkRecord, ShareAccessType } from "@/lib/shareLinks";
import { getSocket } from "@/lib/socket";

import { ModalAlert } from "./components/ui/ModalAlert";
import { SharePopover, AccessType } from "./components/SharePopover";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import Cookies from "js-cookie";

import JsonEditor from "./components/JsonEditor";
import GraphView from "./components/GraphView";
import JsonTreeView from "./components/JsonTreeView";
import TreeExplorer from "./components/TreeExplorer";
import { getLayoutedElements } from "@/lib/graph-layout";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";



// Define serialization manually to avoid import issues or just matching what we did in page.tsx
type SerializedShareLinkRecord = Omit<ShareLinkRecord, "createdAt" | "_id"> & {
  createdAt: string;
  _id?: string;
  accessType?: ShareAccessType;
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null; // Avoid hydration mismatch

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex items-center justify-center"
      title="Toggle Theme"
    >
      {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}

interface HomeProps {
  initialRecord?: SerializedShareLinkRecord;
}

export default function Home({ initialRecord }: HomeProps) {
  const [jsonInput, setJsonInput] = useState<string>(
    initialRecord?.json ||
    '{\n  "project": "JSON Cracker",\n  "visualize": true,\n  "features": [\n    "Graph View",\n    "Tree View",\n    "Formatter"\n  ],\n  "metrics": {\n    "speed": 100,\n    "usability": "high"\n  }\n}'
  );
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [activeTab, setActiveTab] = useState<"visualize" | "tree" | "formatter">(
    initialRecord?.mode || "visualize"
  );
  const [isValid, setIsValid] = useState(true);
  const [layouting, setLayouting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<{ message: string; line?: number } | null>(null);

  // Split state: 
  // 1. jsonInput = Source of Truth for Saving/Graph (Updated by local typing)
  // 2. remoteCode = Source of Truth for Editor Display (Updated ONLY by Socket/System)
  const [remoteCode, setRemoteCode] = useState<string | null>(null);

  // Formatter State moved up to group with others or left here, but socket logic removed from here
  const [tabSize, setTabSize] = useState<string>("2");
  const [isMenuOpen, setIsMenuOpen] = useState(false);



  // Share State
  const [slug, setSlug] = useState<string | null>(initialRecord?.slug || null);
  const [isPrivate, setIsPrivate] = useState(initialRecord?.isPrivate || false);
  const [accessType, setAccessType] = useState<ShareAccessType>(initialRecord?.accessType || "viewer");
  // Helper to determine if current user can edit:
  // - If new file (!slug): Yes
  // - If we have an existing record, check accessType.
  // Note: For a public link, 'viewer' means read-only.
  // We initialize based on record. If I just created it, I essentially have 'editor' rights until reload?
  // For simplicity: If !slug => 'editor' (implied). If slug => use accessType.
  // But wait, if I Open a Public-Viewer link, I am Viewer.
  // If I Create a Public-Viewer link, I am... ?
  // Let's rely on a separate specific state for "My Permission" vs "Record Permission" if needed.
  // But for this scope, let's say:
  // If initialRecord is present, we obey its accessType.
  // If not, we are Editors.
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  // Check ownership on load
  useEffect(() => {
    if (initialRecord?.slug) {
      const ownedSlugs = Cookies.get("json-cracker-owned");
      if (ownedSlugs) {
        try {
          const parsed = JSON.parse(ownedSlugs);
          if (Array.isArray(parsed) && parsed.includes(initialRecord.slug)) {
            setIsOwner(true);
            setCanEdit(true); // Owners always edit
            return;
          }
        } catch (e) { console.error("Cookie parse error", e); }
      }
      // Fallback to accessType if not owner
      // Note: Initial record AccessType logic
      setCanEdit(initialRecord.accessType === "editor");
    } else {
      // New file
      setIsOwner(true);
      setCanEdit(true);
    }
  }, [initialRecord]);

  const addOwnership = (newSlug: string) => {
    const owned = Cookies.get("json-cracker-owned");
    let slugs: string[] = [];
    if (owned) {
      try {
        slugs = JSON.parse(owned);
      } catch (e) { }
    }
    if (!slugs.includes(newSlug)) {
      slugs.push(newSlug);
      Cookies.set("json-cracker-owned", JSON.stringify(slugs), { expires: 30 }); // 30 days
    }
    setIsOwner(true);
  };

  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Track if the record is indefinitely private (persisted as private)
  const [isPersistedPrivate, setIsPersistedPrivate] = useState(
    initialRecord?.isPrivate || false
  );
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Locked State for Private Links
  const [isLocked, setIsLocked] = useState(
    (initialRecord?.isPrivate && !initialRecord?.json) || false
  );
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Refs for stable callback access
  const slugRef = React.useRef(slug);
  const isLockedRef = React.useRef(isLocked);
  const isPrivateRef = React.useRef(isPrivate);
  const isValidRef = React.useRef(isValid);

  useEffect(() => {
    slugRef.current = slug;
    isLockedRef.current = isLocked;
    isPrivateRef.current = isPrivate;
    isValidRef.current = isValid;
  }, [slug, isLocked, isPrivate, isValid]);

  const emitTimeout = React.useRef<NodeJS.Timeout | null>(null);

  // Stable Change Handler
  const handleJsonChange = useCallback((newCode: string | undefined) => {
    const code = newCode || "";
    setJsonInput(code);

    // Debounce socket emission to prevent flooding/lag
    if (emitTimeout.current) clearTimeout(emitTimeout.current);

    emitTimeout.current = setTimeout(() => {
      // Emit change if we have a slug and aren't locked (regardless of validity)
      if (slugRef.current && !isLockedRef.current) {
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit("code-change", { slug: slugRef.current, newCode: code });
        }
      }
    }, 300);
  }, []); // ID IS STABLE NOW

  // Socket Effect
  useEffect(() => {
    if (!slug) return;

    // Connect only when we have access.
    if (isPrivate && isLocked) return;

    const socket = getSocket();

    const onConnect = () => {
      socket.emit("join-room", slug);
    };

    const onCodeChange = (newCode: string) => {
      setJsonInput(newCode); // Update Save State
      setRemoteCode(newCode); // Update Editor Display
    };

    if (socket.connected) {
      onConnect();
    }

    socket.on("connect", onConnect);
    socket.on("code-change", onCodeChange);

    return () => {
      socket.off("connect", onConnect);
      socket.off("code-change", onCodeChange);
    };
  }, [slug, isPrivate, isLocked]);

  // Alert State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (title: string, message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setAlertConfig({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const handleUnlock = async () => {
    if (!initialRecord?.slug) return;
    setUnlockLoading(true);
    setUnlockError(null);
    try {
      const res = await fetch(`/api/share/${initialRecord.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUnlockError(data.error || "Failed to unlock");
        return;
      }

      // Success
      setJsonInput(data.json);
      setRemoteCode(data.json); // Force Editor Update
      setActiveTab(data.mode);
      setIsPrivate(data.isPrivate);
      setAccessType(data.accessType || "viewer");
      // If we unlocked successfully, we essentially have access.
      // If the link is "viewer" only, we are viewers?
      // Yes, if it is a Private Viewer link, even with password you are a viewer.
      // If it is Private Editor, you are Editor.
      setCanEdit(data.accessType === "editor");

      // Check if I am actually the owner (maybe I created it on this device?)
      const ownedSlugs = Cookies.get("json-cracker-owned");
      if (ownedSlugs) {
        try {
          const parsed = JSON.parse(ownedSlugs);
          if (Array.isArray(parsed) && parsed.includes(initialRecord.slug)) {
            setIsOwner(true);
            setCanEdit(true);
          }
        } catch (e) { }
      }

      setIsPersistedPrivate(data.isPrivate);
      setIsLocked(false);
      // Do NOT clear password, keep it for save validation
      // setPassword(""); 

    } catch (err) {
      setUnlockError((err as Error).message);
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleCancelUnlock = () => {
    window.location.href = "/";
  };

  // New Button Handler
  const handleNew = async () => {
    setJsonInput('{\n  "project": "JSON Cracker",\n  "visualize": true,\n  "features": [\n    "Graph View",\n    "Tree View",\n    "Formatter"\n  ],\n  "metrics": {\n    "speed": 100,\n    "usability": "high"\n  }\n}');
    setSlug(null);
    setIsPrivate(false);
    setIsPersistedPrivate(false);
    setAccessType("viewer"); // Default for new link settings
    setCanEdit(true); // New file is always editable
    setPassword("");
    setRemoteCode('{\n  "project": "JSON Cracker",\n  "visualize": true,\n  "features": [\n    "Graph View",\n    "Tree View",\n    "Formatter"\n  ],\n  "metrics": {\n    "speed": 100,\n    "usability": "high"\n  }\n}');

    // Create initial record
    setIsSaving(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: '{\n  "project": "JSON Cracker",\n  "visualize": true,\n  "features": [\n    "Graph View",\n    "Tree View",\n    "Formatter"\n  ],\n  "metrics": {\n    "speed": 100,\n    "usability": "high"\n  }\n}',
          mode: activeTab,
          accessType: "editor" // Initial creation is always editor capable? Actually creation doesn't set accessType unless speicify.
          // Let's Default to 'viewer' for public links if not specified? 
          // Requirements say "accessType dropdown... default viewer".
          // But "New" button creates a record implicitly.
          // Let's default to "public viewer" for auto-created links? Or "public editor"?
          // Typically "New" => "Unsaved".
          // If we Autosave, let's use 'editor' so the Creator can edit it.
          // Wait, 'handleNew' calls POST /api/share.
          // Let's pass accessType: 'editor' so the creator doesn't lock themselves out immediately.
        })
      });
      const data = await res.json();
      if (data.slug) {
        setSlug(data.slug);
        setAccessType(data.accessType || "editor");
        setCanEdit(true); // Implicitly editor of new file
        setIsOwner(true);
        addOwnership(data.slug);
        window.history.pushState({}, "", `/share/${data.slug}`);
      }
    } catch (e) {
      console.error("Failed to create new record", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Save Button Handler
  const handleSave = async () => {
    if (!slug) return;

    if (isPrivate && password.length < 4) {
      showAlert("Invalid Password", "Password must be at least 4 characters for private links.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/share/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: jsonInput,
          mode: activeTab,
          isPrivate,
          accessType, // Preserve current access settings
          password: isPrivate ? password : undefined
        })
      });

      if (res.ok) {
        if (isPrivate) setIsPersistedPrivate(true);
        showAlert("Saved Successfully", "Your changes have been saved.", "success");
      } else {
        const err = await res.json();
        showAlert("Save Failed", err.error || "An error occurred while saving.", "error");
      }
    } catch (e) {
      console.error("Failed to save", e);
      showAlert("Save Failed", "Network error or server unreachable.", "error");
    } finally {
      setIsSaving(false);
    }
  };



  // Resizable Pane Logic
  const [leftWidth, setLeftWidth] = useState(40); // Default 40%
  const [isDragging, setIsDragging] = useState(false);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsDragging(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isDragging) {
      const newWidth = (mouseMoveEvent.clientX / window.innerWidth) * 100;
      // Constraint between 20% and 80%
      if (newWidth > 20 && newWidth < 80) {
        setLeftWidth(newWidth);
      }
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isDragging, resize, stopResizing]);

  // Upload Logic
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      // Success - Redirect
      addOwnership(data.slug);
      window.location.href = `/share/${data.slug}`;

    } catch (error) {
      console.error(error);
      showAlert("Upload Failed", (error as Error).message, "error");
      setIsUploading(false);
    }
  };

  const handleShare = async (settings: { accessType: ShareAccessType; isPrivate: boolean; password?: string }) => {
    // Validate
    if (settings.isPrivate && (!settings.password || settings.password.length < 4)) {
      showAlert("Invalid Password", "Password must be at least 4 characters.", "error");
      return;
    }

    setIsSaving(true);
    // If no slug, create new
    const method = slug ? "PUT" : "POST";
    const url = slug ? `/api/share/${slug}` : "/api/share";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: jsonInput,
          mode: activeTab,
          isPrivate: settings.isPrivate,
          accessType: settings.accessType,
          password: settings.password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Share failed");
      }

      // Success
      const newSlug = data.slug || slug;
      if (newSlug !== slug) {
        setSlug(newSlug);
        addOwnership(newSlug); // Mark as owner of new/updated slug
        window.history.pushState({}, "", `/share/${newSlug}`);
      }

      // Update local state
      setAccessType(settings.accessType);
      setIsPrivate(settings.isPrivate);
      if (settings.isPrivate) setIsPersistedPrivate(true);
      if (settings.password) setPassword(settings.password);

      // Copy Link
      const link = `${window.location.origin}/share/${newSlug}`;
      let message = "Settings saved and link copied to clipboard!";
      try {
        await navigator.clipboard.writeText(link);
      } catch (err) {
        console.warn("Clipboard write failed", err);
        message = "Settings saved. You can copy the link from the address bar.";
      }

      setIsShareOpen(false);
      showAlert("Link Shared", message, "success");

    } catch (e) {
      console.error(e);
      showAlert("Share Failed", (e as Error).message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Debounce the input for Layout calculations (500ms)
  const debouncedJsonInput = useDebounce(jsonInput, 500);

  // Layout Effect - Depends on debounced input
  useEffect(() => {
    if (!debouncedJsonInput || !debouncedJsonInput.trim()) {
      setParsedJson(null);
      setIsValid(true);
      setNodes([]);
      setEdges([]);
      setErrorMessage(null);
      return;
    }

    try {
      const parsed = JSON.parse(debouncedJsonInput);
      setParsedJson(parsed);
      setIsValid(true);
      setErrorMessage(null);

      if (activeTab === "visualize") {
        setLayouting(true);
        getLayoutedElements(parsed).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
          setLayouting(false);
        });
      }
    } catch (e) {
      setIsValid(false);
      if (e instanceof SyntaxError) {
        setErrorMessage(getJsonParseError(debouncedJsonInput, e));
      }
    }
  }, [debouncedJsonInput, activeTab]);

  const handleCopy = () => {
    // Copy the formatted output, not the input, if we are in format tab
    if (activeTab === "formatter" && formattedOutput) {
      navigator.clipboard.writeText(formattedOutput);
    } else {
      navigator.clipboard.writeText(jsonInput);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Computed Formatted Output
  const formattedOutput = React.useMemo(() => {
    if (!parsedJson) return "";
    if (tabSize === "minify") {
      return JSON.stringify(parsedJson);
    }
    return JSON.stringify(parsedJson, null, Number(tabSize));
  }, [parsedJson, tabSize]);


  // Mobile specific view state
  const [mobileTab, setMobileTab] = useState<"editor" | "viewer">("editor");

  return (
    <div className="flex h-[100dvh] w-screen bg-gray-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-300 font-sans overflow-hidden">

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Bar */}
        <header className="h-14 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between px-4 lg:px-6 bg-white dark:bg-zinc-950 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[120px] sm:max-w-none">
              {activeTab === 'visualize' ? 'Graph' : activeTab === 'tree' ? 'Tree' : 'Formatter'}
            </h1>
            {!isValid && (
              <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] sm:text-xs font-medium whitespace-nowrap">
                Invalid
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Upload Button */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              title="Upload JSON"
            >
              <UploadCloud size={14} />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* New Button */}
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              title="Create New"
            >
              <FolderPlus size={14} />
              <span className="hidden sm:inline">New</span>
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={!slug || isSaving}
              className={cn(
                "flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                !slug
                  ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-900/20"
              )}
            >
              <Save size={14} />
              <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
            </button>

            <button
              onClick={() => setIsShareOpen(true)}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-md text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
              )}
            >
              <LinkIcon size={14} />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Header Icons: Github & Theme */}
            <div className="hidden sm:flex items-center">
              <a
                href="https://github.com/Softcolon-Technology/jsonrock"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex items-center justify-center"
                title="View Source on GitHub"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>

              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Split View */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

          {/* Editor Pane (Left/Top) */}
          <div
            style={{ "--left-panel-width": `${leftWidth}%` } as React.CSSProperties}
            className={cn(
              "border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-900 flex flex-col bg-white dark:bg-[#09090b] h-full",
              "w-full lg:w-[var(--left-panel-width)] lg:min-w-[300px]",
              // Mobile visibility toggle
              mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'
            )}>
            <div className="flex-1 relative">
              <JsonEditor
                className="pt-14 lg:pt-0"
                defaultValue={jsonInput} // Initial Load Only
                remoteValue={remoteCode} // Updates Only
                onChange={handleJsonChange}
                readOnly={!canEdit}
                options={{
                  padding: { top: 16, bottom: 100 } // Ensure last lines are visible above floating alert
                }}
              />


              {/* Error Alert Overlay */}
              {!isValid && errorMessage && (
                <div className="absolute bottom-4 left-4 right-4 lg:bottom-6 lg:left-8 lg:right-8 z-30 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-white/95 dark:bg-zinc-900/95 border border-red-200 dark:border-red-900/50 backdrop-blur-md p-3 lg:p-4 rounded-xl shadow-xl flex items-start gap-3 lg:gap-4 ring-1 ring-black/5 dark:ring-white/5">
                    <div className="p-1.5 lg:p-2 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 rounded-lg text-red-600 dark:text-red-500 shrink-0 shadow-sm">
                      <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 lg:gap-4">
                        <h4 className="text-xs lg:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          Invalid JSON
                        </h4>
                        {errorMessage.line && (
                          <span className="text-[10px] font-mono font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 px-1.5 lg:px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                            Line {errorMessage.line}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] lg:text-xs text-zinc-600 dark:text-zinc-400 mt-1 lg:mt-1.5 font-mono break-words leading-relaxed border-l-2 border-red-200 dark:border-red-900/50 pl-2 lg:pl-3">
                        {errorMessage.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Go to View Button (Mobile Only) */}
              <div className="lg:hidden absolute top-2 right-14 z-20">
                <button
                  onClick={() => setMobileTab("viewer")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-900/20 font-medium text-xs hover:bg-emerald-500 transition-transform active:scale-95 backdrop-blur-sm opacity-90 hover:opacity-100"
                >
                  Go to View
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Resizer Handle */}
          <div
            className={`hidden lg:flex w-1 bg-transparent cursor-col-resize z-40 items-center justify-center transition-colors`}
            onMouseDown={startResizing}
          >
            {/* Optional Grip Icon or dots */}
          </div>

          {/* View Pane (Right/Bottom) */}
          <div
            style={{ "--right-panel-width": `${100 - leftWidth}%` } as React.CSSProperties}
            className={cn(
              "bg-gray-50 dark:bg-[#050505] relative overflow-hidden h-full",
              "w-full lg:w-[var(--right-panel-width)]",
              // Mobile visibility toggle
              mobileTab === 'viewer' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
            )}>

            {/* Back to Editor Button (Mobile Only) */}
            <div className="lg:hidden absolute top-2 right-10 z-[70]">
              <button
                onClick={() => setMobileTab("editor")}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 dark:bg-zinc-700 text-white rounded-full shadow-lg font-medium text-xs hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-transform active:scale-95 backdrop-blur-sm opacity-90 hover:opacity-100"
              >
                <Code2 size={14} />
                Back to Editor
              </button>
            </div>




            {/* Navigation: Sidebar for Graph/Formatter/Tree */}
            <div className="absolute top-4 left-4 z-50 flex flex-col gap-3">
              {/* Graph View Button */}
              <div className="relative group">
                <button
                  onClick={() => setActiveTab("visualize")}
                  className={cn(
                    "p-2 rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200",
                    activeTab === "visualize"
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20 scale-105"
                      : "bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 hover:scale-105"
                  )}
                >
                  <GitGraph size={18} />
                </button>
                {/* Tooltip */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700">
                  Graph View
                </div>
              </div>

              {/* Tree View Button */}
              <div className="relative group">
                <button
                  onClick={() => setActiveTab("tree")}
                  className={cn(
                    "p-2 rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200",
                    (activeTab == "formatter" || activeTab == "visualize") ?
                      "bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 hover:scale-105" :
                      "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20 scale-105")}
                >
                  <LayoutTemplate size={18} />
                </button>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700">
                  Tree Explorer
                </div>
              </div>

              {/* Formatter View Button */}
              <div className="relative group">
                <button
                  onClick={() => setActiveTab("formatter")}
                  className={cn(
                    "p-2 rounded-full shadow-lg border backdrop-blur-sm transition-all duration-200",
                    activeTab === "formatter"
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20 scale-105"
                      : "bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 hover:scale-105"
                  )}
                >
                  <Code2 size={18} />
                </button>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-200 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800 dark:border-zinc-700">
                  JSON Formatter
                </div>
              </div>
            </div>
            {isValid && !parsedJson ? (
              <div className="h-full w-full flex flex-col items-center justify-center pl-16 animate-in fade-in zoom-in-95 duration-200">
                <div className="mb-4 p-4 rounded-full bg-zinc-200 dark:bg-zinc-800/50">
                  <Code2 size={48} className="opacity-50 text-zinc-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">Empty JSON</h3>
                <p className="max-w-xs text-center text-sm text-zinc-500">
                  Please enter valid JSON data in the editor to visualize it.
                </p>
              </div>
            ) : (
              <>
                {activeTab === "visualize" && (
                  <div className="h-full w-full pl-16">
                    {layouting ? (
                      <div className="flex h-full items-center justify-center text-zinc-500 gap-2">
                        <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                        Layouting...
                      </div>
                    ) : (
                      <GraphView nodes={nodes} edges={edges} />
                    )}
                  </div>
                )}

                {activeTab === "tree" && (
                  <div className="h-full w-full overflow-hidden pl-16">
                    <TreeExplorer data={parsedJson} />
                  </div>
                )}

                {activeTab === "formatter" && (
                  <div className="h-full w-full flex flex-col">
                    <div className="flex items-center justify-between pl-4 pr-4 py-1 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b border-zinc-300 dark:border-zinc-700 h-11 shrink-0 ml-16">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">JSON Formatter</span>
                        <select
                          value={tabSize}
                          onChange={(e) => setTabSize(e.target.value)}
                          className="bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-900 dark:text-zinc-300 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500/50 outline-none cursor-pointer"
                        >
                          <option value="2">2 Tabs</option>
                          <option value="3">3 Tabs</option>
                          <option value="4">4 Tabs</option>
                          <option value="minify">Minify</option>
                        </select>
                      </div>
                      <button onClick={handleCopy} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors group relative">
                        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-200" />}
                        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 text-zinc-300 text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">Copy Output</span>
                      </button>
                    </div>
                    <div className="flex-1 ml-16">
                      <JsonEditor defaultValue={formattedOutput} remoteValue={formattedOutput} onChange={() => { }} readOnly={true} className="rounded-none border-0 shadow-none" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div >
      <ModalAlert
        isOpen={alertConfig.isOpen}
        onClose={closeAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <UploadCloud size={20} className="text-emerald-500" />
                Upload JSON File
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div
                className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col items-center justify-center text-center hover:border-emerald-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={32} className="text-zinc-400 mb-2" />
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Click to select file
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  .json files only
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {isUploading && (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-500 animate-pulse">
                  <span>Uploading and processing...</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  disabled={isUploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal */}
      {
        isLocked && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                  <Lock size={20} />
                </div>
                <h2 className="text-lg font-semibold text-zinc-100">Password Required</h2>
                <p className="text-sm text-zinc-400">
                  This shared link is password protected. Please enter the password to view.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUnlock();
                    }}
                  />
                </div>

                {unlockError && (
                  <div className="text-red-400 text-xs text-center border border-red-500/20 bg-red-500/10 p-2 rounded">
                    {unlockError}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancelUnlock}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUnlock}
                    disabled={unlockLoading || !password}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {unlockLoading ? "Verifying..." : "Unlock"}
                    {!unlockLoading && <ArrowRight size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      <SharePopover
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        initialAccessType={accessType}
        initialIsPrivate={isPrivate}
        initialPassword={password}
        canConfigure={isOwner}
        isLockedPrivate={isPersistedPrivate}
        onShare={handleShare}
        isLoading={isSaving}
      />
    </div >
  );
}


