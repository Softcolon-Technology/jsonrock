import React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyTableProps {
    data: any;
    name?: string;
}

const getType = (value: any): string => {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
};

const getStringValue = (value: any, type: string): string => {
    if (type === "object" || type === "array") return "...";
    if (type === "null") return "null";
    if (type === "undefined") return "undefined";
    return String(value);
};

export default function PropertyTable({ data, name }: PropertyTableProps) {
    // If data is null/undefined, handle gracefully
    if (data === undefined) return null;

    // Determine what to show
    // If "data" is an object/array, we show its children as rows.
    // If "data" is primitive, we show ITSELF as the row? Or do we expect the parent to have passed the object?
    // Based on "stack.hu", clicking a node shows its properties. 
    // If I click a leaf (Key: Value), it usually shows that Key/Value.
    // Let's assume 'data' is the value of the selected node.

    let entries: [string, any][] = [];
    const [tooltip, setTooltip] = React.useState<{ x: number; y: number; content: string } | null>(null);
    const timerRef = React.useRef<any>(null);
    const posRef = React.useRef({ x: 0, y: 0 });

    const handleMouseEnter = (content: string) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const currentPos = posRef.current;
        timerRef.current = setTimeout(() => {
            setTooltip({
                x: currentPos.x,
                y: currentPos.y,
                content
            });
        }, 600);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        posRef.current = { x: e.clientX, y: e.clientY };
        if (tooltip) {
            setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
        }
    };

    const handleMouseLeave = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setTooltip(null);
    };

    const type = getType(data);
    const isComplex = type === "object" || type === "array";

    if (isComplex && data !== null) {
        entries = Object.entries(data);
    } else {
        // Primitive selected.
        // We probably want to visualize it as "Name: <name>, Value: <data>"
        // But 'name' prop might be passed.
        entries = [[name || "value", data]];
    }

    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-[#050505] border-l border-zinc-200 dark:border-zinc-800 font-sans text-sm">
            {/* Header / Toolbar-like look */}
            <div className="flex items-center px-2 py-1 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-zinc-800 dark:to-zinc-900 border-b border-zinc-300 dark:border-zinc-700 h-7 shrink-0">
                {/* Mimic standard header or just empty for now */}
            </div>

            {/* Table Header */}
            <div className="flex bg-gray-100 dark:bg-zinc-800 border-b border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 select-none">
                <div className="flex-1 px-2 py-1 border-r border-zinc-300 dark:border-zinc-700 flex items-center">
                    Name
                </div>
                <div className="flex-[2] px-2 py-1 flex items-center">
                    Value
                </div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#0a0a0a]">
                <table className="w-full min-w-[300px] border-collapse text-xs">
                    <tbody>
                        {entries.map(([key, value], index) => {
                            const valType = getType(value);
                            const displayVal = getStringValue(value, valType);
                            const isRowComplex = valType === "object" || valType === "array";
                            const fullValue = isRowComplex ? JSON.stringify(value, null, 2) : displayVal;

                            return (
                                <tr key={key} className="even:bg-zinc-50 dark:even:bg-zinc-900/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 group">
                                    <td className="w-1/3 border-r border-b border-zinc-200 dark:border-zinc-800 px-2 py-1 align-top text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[150px]">
                                        {key}
                                    </td>
                                    <td
                                        className="w-2/3 border-b border-zinc-200 dark:border-zinc-800 px-2 py-1 align-top text-zinc-600 dark:text-zinc-400 font-mono truncate max-w-[200px]"
                                        onMouseEnter={() => isRowComplex && handleMouseEnter(fullValue)}
                                        onMouseMove={(e) => isRowComplex && handleMouseMove(e)}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={cn(isRowComplex && "text-zinc-400 italic")}>{displayVal}</span>
                                            <ValueCopyButton value={isRowComplex ? JSON.stringify(value) : String(value)} />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {entries.length === 0 && (
                            <tr>
                                <td colSpan={2} className="px-2 py-4 text-center text-zinc-400 italic">
                                    Empty {type}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {tooltip && (
                <div
                    className="fixed z-[9999] max-w-sm whitespace-pre-wrap break-words bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg shadow-xl text-xs font-mono pointer-events-none"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: `translate(${tooltip.x > (typeof window !== 'undefined' ? window.innerWidth : 0) * 0.6 ? '-100%' : '0'}, ${tooltip.y > (typeof window !== 'undefined' ? window.innerHeight : 0) * 0.6 ? '-100%' : '0'})`,
                        marginLeft: tooltip.x > (typeof window !== 'undefined' ? window.innerWidth : 0) * 0.6 ? -12 : 12,
                        marginTop: tooltip.y > (typeof window !== 'undefined' ? window.innerHeight : 0) * 0.6 ? -12 : 12
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
}

function ValueCopyButton({ value }: { value: string }) {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="hidden group-hover:block ml-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            title="Copy Value"
        >
            {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
        </button>
    )
}
