import { cn } from "@/lib/utils";
import { ShareType } from "@/app/iterface";

interface Props {
  documentType: ShareType;
  onClick: () => void;
  label: string;
  title: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const EditorActionBtn = ({
  onClick,
  documentType,
  label,
  title,
  icon,
  shortcut,
}: Props) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 border border-zinc-200 transition-all text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none",
        documentType !== "text" &&
          "dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
      )}
      title={shortcut ? `${title} (${shortcut})` : title}
      aria-label={label}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
};

export default EditorActionBtn;
