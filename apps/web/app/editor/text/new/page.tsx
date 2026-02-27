"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Cookies from "js-cookie";

export default function NewTextDocPage() {
  const router = useRouter();

  useEffect(() => {
    const createAndRedirect = async () => {
      try {
        // Default to editor access when creating new
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "text",
            accessType: "editor",
            json: '<p style="font-size: 14pt">Type your text here...</p>',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.slug) {
            // Store ownership
            const owned = Cookies.get("json-cracker-owned");
            let slugs: string[] = [];
            if (owned) {
              try {
                const parsed = JSON.parse(owned);
                if (Array.isArray(parsed)) slugs = parsed;
              } catch (e) {
                console.error("Cookie parse error", e);
              }
            }
            if (!slugs.includes(data.slug)) {
              slugs.push(data.slug);
              Cookies.set("json-cracker-owned", JSON.stringify(slugs), {
                expires: 30,
                path: "/",
              });
            }

            router.replace(`/editor/text/${data.slug}`);
          }
        } else {
          console.error("Failed to create new text session");
        }
      } catch (error) {
        console.error("Error creating text session:", error);
      }
    };

    createAndRedirect();
  }, [router]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-[#09090b] text-zinc-500">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-600" />
      <p>Creating new document...</p>
    </div>
  );
}
