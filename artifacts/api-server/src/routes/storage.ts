import { Readable } from "node:stream";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { db, salesAdjustmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "./auth";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

async function streamResponse(
  file: Awaited<ReturnType<ObjectStorageService["getObjectEntityFile"]>>,
  res: Response,
) {
  const response = await storage.downloadObject(file);
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
}

router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success || parsed.data.size > MAX_RECEIPT_BYTES) {
      res.status(400).json({ error: "صورة الإشعار غير صالحة أو أكبر من 10 ميغابايت" });
      return;
    }
    try {
      const { name, size, contentType } = parsed.data;
      const uploadURL = await storage.getObjectEntityUploadURL();
      const objectPath = storage.normalizeObjectEntityPath(uploadURL);
      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating private upload URL");
      res.status(500).json({ error: "تعذر تجهيز رفع الصورة" });
    }
  },
);

router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join("/") : raw;
      const file = await storage.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      await streamResponse(file, res);
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

router.get(
  "/storage/objects/*path",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.path;
      const objectPath = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
      const [referenced] = await db
        .select({ id: salesAdjustmentsTable.id })
        .from(salesAdjustmentsTable)
        .where(eq(salesAdjustmentsTable.refundProofPath, objectPath))
        .limit(1);
      if (!referenced) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      const file = await storage.getObjectEntityFile(objectPath);
      const [metadata] = await file.getMetadata();
      if (
        typeof metadata.contentType !== "string" ||
        !metadata.contentType.startsWith("image/") ||
        Number(metadata.size ?? 0) > MAX_RECEIPT_BYTES
      ) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      await streamResponse(file, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving protected receipt");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;