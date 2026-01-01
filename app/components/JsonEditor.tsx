import React from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { editor } from "monaco-editor";

interface JsonEditorProps {
    defaultValue?: string;
    remoteValue?: { code: string; nonce: number } | null;
    onChange: (value: string | undefined) => void;
    readOnly?: boolean;
    className?: string;
    options?: editor.IStandaloneEditorConstructionOptions;
}

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const JsonEditor: React.FC<JsonEditorProps> = ({ defaultValue, remoteValue, onChange, readOnly = false, className, options: customOptions }) => {
    const { theme } = useTheme();
    const editorRef = React.useRef<any>(null);
    const monacoRef = React.useRef<any>(null);
    const isRemoteUpdate = React.useRef(false); // Flag to prevent loop

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Define Dark Theme
        monaco.editor.defineTheme("cracker-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: {
                "editor.background": "#09090b", // zinc-950
                "editor.lineHighlightBackground": "#18181b",
            }
        });

        // Define Light Theme
        monaco.editor.defineTheme("cracker-light", {
            base: "vs",
            inherit: true,
            rules: [],
            colors: {
                "editor.background": "#ffffff",
                "editor.lineHighlightBackground": "#f4f4f5", // zinc-100
            }
        });

        // Initial Set
        const currentTheme = theme === 'dark' ? "cracker-dark" : "cracker-light";
        monaco.editor.setTheme(currentTheme);
    };

    // React to theme changes
    React.useEffect(() => {
        if (monacoRef.current) {
            const currentTheme = theme === 'dark' ? "cracker-dark" : "cracker-light";
            monacoRef.current.editor.setTheme(currentTheme);
        }
    }, [theme]);

    // React to remote value changes (Socket or Formatter)
    React.useEffect(() => {
        if (remoteValue && editorRef.current) {
            const currentValue = editorRef.current.getValue();
            if (currentValue !== remoteValue.code) {
                // Set flag to ignore the subsequent onChange trigger
                isRemoteUpdate.current = true;

                // We use executeEdits to preserve undo stack if possible, or setValue for full replace
                // For formatter, setValue is usually cleaner as it's a full transform
                editorRef.current.setValue(remoteValue.code);

                // Reset flag immediately (synchronous)
                isRemoteUpdate.current = false;
            }
        }
    }, [remoteValue]);

    const handleEditorChange = (value: string | undefined, event: any) => {
        // If this change was triggered by our own remote update logic, ignore it
        if (isRemoteUpdate.current) return;

        onChange(value);
    };

    return (
        <div className={cn("h-full w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-inner", className)}>
            <Editor
                height="100%"
                defaultLanguage="json"
                defaultValue={defaultValue}
                onChange={handleEditorChange}
                // Default theme prop is initial only, effect handles updates
                theme={theme === "dark" ? "vs-dark" : "light"}
                options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly,
                    fontFamily: "Geist Mono, monospace",
                    padding: { top: 16, bottom: 16 },
                    scrollbar: {
                        vertical: 'visible',
                        horizontal: 'auto',
                        useShadows: false,
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                        verticalHasArrows: false,
                        horizontalHasArrows: false,
                    },
                    ...customOptions
                }}
                onMount={handleEditorDidMount}
            />
        </div>
    );
};

export default JsonEditor;
