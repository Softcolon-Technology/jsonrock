import { ShareType } from "@/app/iterface";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

interface SaveStatusProps {
  isAutoSaving: boolean;
  documentType: ShareType;
}

const SaveStatus = ({ isAutoSaving, documentType }: SaveStatusProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 text-xs font-medium text-zinc-500 select-none",
        documentType !== "text" && "dark:text-zinc-400",
      )}
    >
      {isAutoSaving ? (
        <span className="flex items-center gap-1.5">
          <Loader2 size={14} className="animate-spin text-zinc-400" /> Saving...
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <Check size={14} className="text-emerald-500" /> Saved
        </span>
      )}
    </div>
  );
};

export default SaveStatus;
