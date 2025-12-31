import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { generateSlug } from "@/lib/utils";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Read file content
        const text = await file.text();

        // Validate JSON
        try {
            JSON.parse(text);
        } catch {
            return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
        }

        const db = await getDb();
        const collection = db.collection("share_links");

        // Generate unique slug
        let slug = generateSlug();
        while (await collection.findOne({ slug })) {
            slug = generateSlug();
        }

        // Insert new record
        await collection.insertOne({
            slug,
            json: text,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPrivate: false,
            accessType: "editor", // Default to editor for uploaded files
            passwordHash: null,
        });

        return NextResponse.json({ slug });

    } catch (error) {
        console.error("Upload API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
