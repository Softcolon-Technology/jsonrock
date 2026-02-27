import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:bg-emerald-900/20 dark:hover:text-zinc-200 transition-colors flex items-center justify-center"
      title="Toggle Theme"
      aria-label="Toggle Theme"
    >
      {resolvedTheme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
