import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function RedirectToTextChat({ params }: Props) {
  const { slug } = await params;

  try {
    // Check if slug exists
    const checkRes = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/share/${slug}`,
      {
        cache: "no-store",
      },
    );

    if (!checkRes.ok) {
      // Slug doesn't exist, create it via API
      const createRes = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: slug,
            type: "text",
            json: "",
            mode: "visualize",
            isPrivate: false,
            accessType: "editor",
          }),
          cache: "no-store",
        },
      );

      if (!createRes.ok) {
        console.error("Failed to create slug:", await createRes.text());
        // Still redirect even if creation failed - the /editor/text/[slug] page will handle it
      }
    }
  } catch (error) {
    console.error("Error in slug auto-creation:", error);
    // Continue to redirect even on error
  }

  // Redirect to the text editor page
  redirect(`/editor/text/${slug}`);
}
