import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Saves an uploaded file from FormData to the configured local folder.
 * Returns the public web URL path of the saved file, or null if no file was uploaded.
 */
export async function uploadFile(file: File | null): Promise<string | null> {
  if (!file || !(file instanceof File) || file.size === 0 || file.name === "undefined") {
    return null;
  }

  const uploadDir = process.env.UPLOAD_DIR || "./public/uploads";
  const publicUrlBase = process.env.NEXT_PUBLIC_UPLOAD_URL || "/uploads";

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileExt = path.extname(file.name);
  const uniqueName = `${crypto.randomUUID()}${fileExt}`;

  const filePath = path.join(uploadDir, uniqueName);

  // Convert File object to Node Buffer and save
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(filePath, buffer);

  return `${publicUrlBase}/${uniqueName}`;
}
