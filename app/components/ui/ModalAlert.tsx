"use client";

import React from "react";
import { AlertCircle, CheckCircle, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertType = "success" | "error" | "info" | "warning";

interface ModalAlertProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: AlertType;
}

const icons = {
    success: <CheckCircle className="text-emerald-500" size={32} />,
    error: <XCircle className="text-red-500" size={32} />,
    warning: <AlertCircle className="text-amber-500" size={32} />,
    info: <AlertCircle className="text-blue-500" size={32} />,
};

export function ModalAlert({ isOpen, onClose, title, message, type = "info" }: ModalAlertProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl shadow-2xl max-w-sm w-full p-6 relative animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                >
                    <X size={18} />
                </button>

                <div className="flex flex-col items-center text-center gap-3">
                    <div className="mb-2">{icons[type]}</div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>

                    <button
                        onClick={onClose}
                        className={cn(
                            "mt-4 w-full py-2 rounded-lg font-medium text-sm transition-colors",
                            type === "error" ? "bg-red-600 hover:bg-red-500 text-white" :
                                type === "success" ? "bg-emerald-600 hover:bg-emerald-500 text-white" :
                                    "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100"
                        )}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
