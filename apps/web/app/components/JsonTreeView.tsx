/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TreeActionType = "EXPAND_ALL" | "COLLAPSE_ALL";

export interface TreeAction {
    type: TreeActionType;
    nonce: number;
}

interface JsonTreeViewProps {
    data: any;
    name?: string;
    level?: number;
    initiallyExpanded?: boolean;
    path: string;
    selectedPath?: string | null;
    onSelect?: (path: string, data: any, name?: string) => void;
    treeAction?: TreeAction | null;
}

const getType = (value: any): string => {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
};

const JsonTreeNode: React.FC<JsonTreeViewProps> = ({
    data,
    name,
    level = 0,
    initiallyExpanded = true,
    path,
    selectedPath,
    onSelect,
    treeAction
}) => {
    const [expanded, setExpanded] = useState(initiallyExpanded);
    const [copied, setCopied] = useState(false);

    // Effect to handle Expand All / Collapse All triggers
    useEffect(() => {
        if (!treeAction) return;

        if (treeAction.type === "EXPAND_ALL") {
            setExpanded(true);
        } else if (treeAction.type === "COLLAPSE_ALL") {
            setExpanded(false);
        }
    }, [treeAction]);

    const type = getType(data);
    const isObject = type === "object";
    const isArray = type === "array";
    const isComplex = isObject || isArray;
    const isEmpty = isComplex && (Object.keys(data).length === 0);

    const isSelected = selectedPath === path;

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const textToCopy = name !== undefined
            ? `"${name}": ${JSON.stringify(data)}`
            : JSON.stringify(data);
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSelect) {
            onSelect(path, data, name);
        }
    };

    const renderValue = (value: any, type: string) => {
        switch (type) {
            case "string":
                return <span className="text-red-400">&quot;{value}&quot;</span>;
            case "number":
                return <span className="text-blue-400">{value}</span>;
            case "boolean":
                return <span className="text-purple-400">{value.toString()}</span>;
            case "null":
                return <span className="text-zinc-500">null</span>;
            default:
                return <span className="text-zinc-300">{String(value)}</span>;
        }
    };

    // Updated Icons to match screenshots more closely or stay clean
    const renderIcon = () => {
        if (isArray) return <span className="text-zinc-500 font-bold px-1 text-[10px]">[]</span>;
        if (isObject) return <span className="text-zinc-500 font-bold px-1 text-[10px]">{"{}"}</span>;
        return <div className="w-1.5 h-1.5 rounded-sm bg-blue-500/50 mx-1" />;
    }

    return (
        <div className="font-mono text-xs leading-5 select-none whitespace-nowrap">
            <div
                className={cn(
                    "flex items-center rounded-sm px-1 -ml-1 cursor-pointer transition-colors group border border-transparent min-w-full w-fit",
                    isSelected
                        ? "bg-[#e5f3ff] dark:bg-[#004b91]/30 border-[#cce8ff] dark:border-[#003366]"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                )}
                onClick={handleSelect}
            >

                {/* Expander Icon */}
                <div
                    className="w-4 h-4 mr-0.5 flex items-center justify-center shrink-0 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200 text-zinc-400"
                    onClick={isComplex && !isEmpty ? toggleExpand : undefined}
                >
                    {isComplex && !isEmpty && (
                        expanded ?
                            <div className="border border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-800 w-[9px] h-[9px] flex items-center justify-center rounded-[1px] shadow-sm"><span className="text-[7px] leading-none mb-px font-bold text-zinc-600 dark:text-zinc-300">-</span></div> :
                            <div className="border border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-800 w-[9px] h-[9px] flex items-center justify-center rounded-[1px] shadow-sm"><span className="text-[7px] leading-none mb-px font-bold text-zinc-600 dark:text-zinc-300">+</span></div>
                    )}
                </div>

                {/* Icon based on type */}
                <div className="mr-1 flex items-center opacity-70">
                    {renderIcon()}
                </div>

                {/* Key Name */}
                {name !== undefined && (
                    <span className="mr-1.5 text-black dark:text-zinc-200 font-medium">
                        {name}
                    </span>
                )}

                {/* Value or Complex Type Info */}
                {isComplex ? (
                    <span className="text-zinc-400 text-[10px]">
                        {/* {isArray ? `Array[${data.length}]` : `Object{${Object.keys(data).length}}`} */}
                    </span>
                ) : (
                    <div className="flex items-center gap-1.5 group/value">
                        {name && <span className="text-zinc-400 select-none">:</span>}
                        {renderValue(data, type)}
                    </div>
                )}

                {/* Inline Actions */}
                <button
                    onClick={handleCopy}
                    className="ml-auto sticky right-2 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-all shrink-0 backdrop-blur-sm"
                    title="Copy JSON"
                >
                    {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-zinc-400" />}
                </button>
            </div>

            {/* Children */}
            {isComplex && expanded && !isEmpty && (
                <div className="ml-[5px] border-l border-dotted border-zinc-300 dark:border-zinc-700 pl-3">
                    {isArray
                        ? data.map((item: any, index: number) => {
                            const nextPath = `${path}[${index}]`;
                            return (
                                <JsonTreeNode
                                    key={index}
                                    name={String(index)}
                                    data={item}
                                    level={level + 1}
                                    initiallyExpanded={false}
                                    path={nextPath}
                                    selectedPath={selectedPath}
                                    onSelect={onSelect}
                                    treeAction={treeAction}
                                />
                            );
                        })
                        : Object.entries(data).map(([key, value]) => {
                            const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
                                ? `${path}.${key}`
                                : `${path}["${key}"]`;
                            return (
                                <JsonTreeNode
                                    key={key}
                                    name={key}
                                    data={value}
                                    level={level + 1}
                                    initiallyExpanded={false}
                                    path={nextPath}
                                    selectedPath={selectedPath}
                                    onSelect={onSelect}
                                    treeAction={treeAction}
                                />
                            );
                        })}
                </div>
            )}
        </div>
    );
};

export default function JsonTreeView({
    data,
    onSelect,
    selectedPath,
    treeAction
}: {
    data: any;
    onSelect?: (path: string, data: any, name?: string) => void;
    selectedPath?: string | null;
    treeAction?: TreeAction | null;
}) {
    if (!data) {
        return <div className="text-zinc-500 p-4 text-sm">No data to display</div>;
    }
    return (
        <div className="w-full h-full p-2">
            <JsonTreeNode
                data={data}
                name="JSON"
                initiallyExpanded={true}
                path="$"
                selectedPath={selectedPath}
                onSelect={onSelect}
                treeAction={treeAction}
            />
        </div>
    );
}
