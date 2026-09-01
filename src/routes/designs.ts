import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, designsTable } from "@workspace/db";
import {
  ListDesignsResponse,
  CreateDesignBody,
  CreateDesignResponse,
  UpdateDesignParams,
  UpdateDesignBody,
  UpdateDesignResponse,
  DeleteDesignParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { claimObjectOwnership } from "./storage";

const router: IRouter = Router();

router.get("/designs", async (req, res): Promise<void> => {
  const designs = await db
    .select()
    .from(designsTable)
    .where(eq(designsTable.userId, req.userId!))
    .orderBy(desc(designsTable.createdAt));
  res.json(ListDesignsResponse.parse(serializeDates(designs)));
});

router.post("/designs", async (req, res): Promise<void> => {
  const parsed = CreateDesignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [design] = await db
    .insert(designsTable)
    .values({ ...parsed.data, userId: req.userId! })
    .returning();

  await claimObjectOwnership(design.imageDataUrl, req.userId!, req.log);

  res.status(201).json(CreateDesignResponse.parse(serializeDates(design)));
});

router.patch("/designs/:id", async (req, res): Promise<void> => {
  const params = UpdateDesignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDesignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [design] = await db
    .update(designsTable)
    .set(parsed.data)
    .where(and(eq(designsTable.id, params.data.id), eq(designsTable.userId, req.userId!)))
    .returning();

  if (!design) {
    res.status(404).json({ error: "Design not found" });
    return;
  }

  res.json(UpdateDesignResponse.parse(serializeDates(design)));
});

router.delete("/designs/:id", async (req, res): Promise<void> => {
  const params = DeleteDesignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [design] = await db
    .delete(designsTable)
    .where(and(eq(designsTable.id, params.data.id), eq(designsTable.userId, req.userId!)))
    .returning();

  if (!design) {
    res.status(404).json({ error: "Design not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
