import { createHash, timingSafeEqual } from "crypto";
import { getDb } from "./mongodb";
import { generateSlug } from "./utils";

export type JsonShareMode = "visualize" | "tree" | "formatter";

export type ShareAccessType = "editor" | "viewer";

export interface ShareLinkRecord {
  _id?: string;
  slug: string;
  json: string;
  mode: JsonShareMode;
  isPrivate: boolean;
  accessType?: ShareAccessType; // Defaults to 'viewer' if undefined for old records
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}


function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function createShareLink(input: {
  json: string;
  mode: JsonShareMode;
  isPrivate: boolean;
  accessType?: ShareAccessType;
  password?: string;
}): Promise<ShareLinkRecord> {
  const db = await getDb();
  const slug = generateSlug();

  const record: ShareLinkRecord = {
    slug,
    json: input.json,
    mode: input.mode,
    isPrivate: input.isPrivate,
    accessType: input.accessType || "viewer",
    passwordHash: input.isPrivate && input.password ? hashPassword(input.password) : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection<ShareLinkRecord>("share_links").insertOne(record);

  return record;
}

export async function updateShareLink(slug: string, input: {
  json: string;
  mode: JsonShareMode;
  isPrivate: boolean;
  accessType?: ShareAccessType;
  password?: string;
}): Promise<boolean> {
  const db = await getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateDoc: any = {
    json: input.json,
    mode: input.mode,
    isPrivate: input.isPrivate,
    accessType: input.accessType || "viewer",
    updatedAt: new Date(),
  };

  if (input.isPrivate && input.password) {
    updateDoc.passwordHash = hashPassword(input.password);
  } else if (!input.isPrivate) {
    // If switching to public, remove password hash? or keep it but unused? 
    // Let's remove it to be clean or set to null
    updateDoc.passwordHash = null;
  }

  const result = await db.collection<ShareLinkRecord>("share_links").updateOne(
    { slug },
    { $set: updateDoc }
  );

  return !!result;
}

export async function getShareLink(slug: string): Promise<ShareLinkRecord | null> {
  const db = await getDb();
  return db.collection<ShareLinkRecord>("share_links").findOne({ slug });
}

export async function verifyShareLinkPassword(slug: string, password: string): Promise<boolean> {
  const record = await getShareLink(slug);
  if (!record || !record.isPrivate || !record.passwordHash) return false;

  const provided = hashPassword(password);
  const stored = record.passwordHash;

  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(stored, "hex"));
  } catch {
    return false;
  }
}


