import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, contactsTable } from "@workspace/db";
import {
  ListContactsResponse,
  CreateContactBody,
  CreateContactResponse,
  DeleteContactParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/contacts", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.userId, req.userId!))
    .orderBy(desc(contactsTable.createdAt));

  res.json(ListContactsResponse.parse(serializeDates(rows)));
});

router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [contact] = await db
    .insert(contactsTable)
    .values({ ...parsed.data, userId: req.userId! })
    .returning();

  res.status(201).json(CreateContactResponse.parse(serializeDates(contact)));
});

router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const params = DeleteContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const deleted = await db
    .delete(contactsTable)
    .where(
      and(
        eq(contactsTable.id, params.data.id),
        eq(contactsTable.userId, req.userId!),
      ),
    )
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.status(204).end();
});

export default router;
