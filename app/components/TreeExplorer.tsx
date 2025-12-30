"use client";

import React, { useState } from "react";
import JsonTreeView, { TreeAction } from "./JsonTreeView";
import PropertyTable from "./PropertyTable";
import { ChevronsDown, ChevronsUp } from "lucide-react";

export default function TreeExplorer({ data }: { data: any }) {
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [tableData, setTableData] = useState<{
        data: any;
        name?: string;
    } | null>(null);
    const [treeAction, setTreeAction] = useState<TreeAction | null>(null);

    const onSelect = (path: string, nodeData: any, name?: string) => {
        // Always highlight the clicked node in the tree
        setSelectedPath(path);

        // Only update the table if the selected node is an Object or Array
        // This keeps the parent/context visible when clicking leaf nodes
        if (nodeData !== null && typeof nodeData === 'object') {
            setTableData({ data: nodeData, name });
        }
    };

    const handleExpandAll = () => {
        setTreeAction({ type: "EXPAND_ALL", nonce: Date.now() });
    };

    const handleCollapseAll = () => {
        setTreeAction({ type: "COLLAPSE_ALL", nonce: Date.now() });
    };

    // Resizing Logic
    const [leftWidth, setLeftWidth] = useState(60);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const startResizing = React.useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const stopResizing = React.useCallback(() => {
        setIsDragging(false);
    }, []);

    const resize = React.useCallback((e: MouseEvent) => {
        if (isDragging && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const newPercentage = (offsetX / rect.width) * 100;
            if (newPercentage > 20 && newPercentage < 80) {
                setLeftWidth(newPercentage);
            }
        }
    }, [isDragging]);

    React.useEffect(() => {
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

    return (
        <div
            ref={containerRef}
            className="flex h-full w-full overflow-hidden bg-white dark:bg-[#050505] flex-col md:flex-row select-none"
            style={{ "--tree-left-width": `${leftWidth}%` } as React.CSSProperties}
        >
            {/* Left Pane - Tree View */}
            <div className="w-full md:w-[var(--tree-left-width)] min-w-[200px] border-r border-zinc-200 dark:border-zinc-800 overflow-auto bg-white dark:bg-[#09090b] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between pl-4 pr-4 py-1 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b border-zinc-300 dark:border-zinc-700 h-11 shrink-0">
                    <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">JSON Structure</span>
                    <div className="flex items-center gap-1 mr-[150px] lg:mr-0 z-50">
                        {/* Note: mr-150px was for mobile button avoidance, check if still needed. 
                            With 3-pane layout on desktop, we might not need overlap protection as much.
                            On mobile, layout is stacked. 
                        */}
                        <button
                            onClick={handleExpandAll}
                            className="group relative flex items-center justify-center p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        >
                            <ChevronsDown size={16} />
                            <span className="absolute top-full right-0 mt-1 px-2 py-1 bg-zinc-800 text-zinc-200 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                Expand All
                            </span>
                        </button>
                        <button
                            onClick={handleCollapseAll}
                            className="group relative flex items-center justify-center p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        >
                            <ChevronsUp size={16} />
                            <span className="absolute top-full right-0 mt-1 px-2 py-1 bg-zinc-800 text-zinc-200 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                Collapse All
                            </span>
                        </button>
                    </div>
                </div>
                <div className="p-2 flex-1">
                    <JsonTreeView
                        data={data}
                        onSelect={onSelect}
                        selectedPath={selectedPath}
                        treeAction={treeAction}
                    />
                </div>
            </div>

            {/* Drag Handle */}
            <div
                className={`hidden md:flex w-1 bg-transparent cursor-col-resize z-40 items-center justify-center transition-colors shrink-0`}
                onMouseDown={startResizing}
            />

            {/* Right Pane - Property Table */}
            <div className="flex-1 overflow-hidden bg-white dark:bg-[#0a0a0a] min-w-[200px]">
                <PropertyTable
                    data={tableData?.data}
                    name={tableData?.name}
                />
            </div>
        </div>
    );
}
