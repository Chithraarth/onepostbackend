import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import {
  ListAccountsResponse,
  CreateAccountBody,
  CreateAccountResponse,
  UpdateAccountParams,
  UpdateAccountBody,
  UpdateAccountResponse,
  DeleteAccountParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/accounts", async (req, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.userId, req.userId!))
    .orderBy(accountsTable.createdAt);
  res.json(ListAccountsResponse.parse(serializeDates(accounts)));
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .insert(accountsTable)
    .values({ ...parsed.data, userId: req.userId! })
    .returning();

  res.status(201).json(CreateAccountResponse.parse(serializeDates(account)));
});

router.patch("/accounts/:id", async (req, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .update(accountsTable)
    .set(parsed.data)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, req.userId!)))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.json(UpdateAccountResponse.parse(serializeDates(account)));
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db
    .delete(accountsTable)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.userId, req.userId!)))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
