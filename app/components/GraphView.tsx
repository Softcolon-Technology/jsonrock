import React, { useCallback } from "react";
import ReactFlow, {
    Background,
    Controls,
    ControlButton,
    Edge,
    Node,
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import JsonNode from "./JsonNode";
import { Lock, Unlock } from "lucide-react";

const nodeTypes = {
    jsonNode: JsonNode,
};

interface GraphViewProps {
    nodes: Node[];
    edges: Edge[];
}

import { NodeModal } from "./NodeModal";
import { GraphNodeData } from "@/lib/graph-layout";
import { cn } from "@/lib/utils";

import { useTheme } from "next-themes";

// ...

const GraphViewContent: React.FC<GraphViewProps> = ({ nodes, edges }) => {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [mounted, setMounted] = React.useState(false);
    const [selectedNode, setSelectedNode] = React.useState<{ content: any; path: string } | null>(null);
    const [isLocked, setIsLocked] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        const data = node.data as GraphNodeData;
        if (data.content !== undefined && data.path) {
            setSelectedNode({
                content: data.content,
                path: data.path
            });
        }
    }, []);

    if (!mounted) return null;

    return (
        <div className={cn("h-full w-full relative", isDark ? "bg-[#050505]" : "bg-gray-50")}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                fitView
                minZoom={0.1}
                maxZoom={1.5}
                panOnDrag={!isLocked}
                zoomOnScroll={!isLocked}
                zoomOnPinch={!isLocked}
                zoomOnDoubleClick={!isLocked}
                panOnScroll={!isLocked}
                elementsSelectable={!isLocked}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: isDark ? '#52525b' : '#d4d4d8', strokeWidth: 1.5 },
                }}
                proOptions={{ hideAttribution: true }}
                onlyRenderVisibleElements={true}
                nodesDraggable={false}
                nodesConnectable={false}
                panActivationKeyCode={null}
                zoomActivationKeyCode={isLocked ? null : "Meta"}
            >
                <Background color={isDark ? "#18181b" : "#e4e4e7"} gap={20} size={1} />
                <Controls
                    showInteractive={false}
                    className={cn(
                        "rounded-lg overflow-hidden shadow-xl border",

                        // === LIGHT MODE ===
                        "!bg-zinc-900 !border-zinc-800",
                        "[&>button]:!bg-zinc-900 [&>button]:!border-zinc-800",
                        "[&>button]:!text-zinc-50",
                        "[&>button:hover]:!bg-zinc-800",

                        // Icon Handling
                        "[&_svg:not(.lucide)]:!fill-current",
                        "[&_.lucide]:!stroke-current [&_.lucide]:!fill-none",

                        // === DARK MODE ===
                        "dark:!bg-white dark:!border-zinc-200",
                        "dark:[&>button]:!bg-white dark:[&>button]:!border-zinc-200",
                        "dark:[&>button]:!text-zinc-900",
                        "dark:[&>button:hover]:!bg-zinc-100",

                        // === LOCKED STATE ===
                        isLocked && "[&>button:not(:last-child)]:pointer-events-none [&>button:not(:last-child)]:opacity-50"
                    )}
                >
                    <ControlButton
                        onClick={() => setIsLocked(!isLocked)}
                        title={isLocked ? "Unlock Viewport" : "Lock Viewport"}
                        className="!border-t !border-zinc-800 dark:!border-zinc-200"
                    >
                        {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    </ControlButton>
                </Controls>
                <Panel position="bottom-center" className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur px-4 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 text-xs text-zinc-500">
                    {nodes.length} nodes • {edges.length} connections
                </Panel>
            </ReactFlow>

            <NodeModal
                isOpen={!!selectedNode}
                onClose={() => setSelectedNode(null)}
                data={selectedNode || { content: {}, path: "" }}
            />
        </div>
    );
};

export default function GraphView(props: GraphViewProps) {
    return (
        <ReactFlowProvider>
            <GraphViewContent {...props} />
        </ReactFlowProvider>
    );
}
