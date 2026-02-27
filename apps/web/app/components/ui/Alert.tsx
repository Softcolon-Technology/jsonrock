import React from "react";
import { AlertTriangle, XCircle, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "success" | "warning" | "info";

interface AlertProps {
    variant?: AlertVariant;
    title?: string;
    children: React.ReactNode;
    className?: string;
}

const variantStyles: Record<AlertVariant, string> = {
    error: "bg-red-500/10 border-red-500/20 text-red-500",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-500",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-500",
};

const icons: Record<AlertVariant, React.ReactNode> = {
    error: <XCircle size={18} />,
    success: <CheckCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
};

export function Alert({ variant = "info", title, children, className }: AlertProps) {
    return (
        <div
            className={cn(
                "flex items-start gap-3 rounded-lg border p-4 text-sm",
                variantStyles[variant],
                className
            )}
        >
            <div className="mt-0.5 shrink-0">{icons[variant]}</div>
            <div className="flex-1">
                {title && <h5 className="mb-1 font-medium leading-none tracking-tight">{title}</h5>}
                <div className="opacity-90">{children}</div>
            </div>
        </div>
    );
}
