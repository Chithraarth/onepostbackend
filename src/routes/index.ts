import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import postsRouter from "./posts";
import designsRouter from "./designs";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import subscriptionRouter from "./subscription";
import contactsRouter from "./contacts";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth, accountsRouter);
router.use(requireAuth, postsRouter);
router.use(requireAuth, designsRouter);
router.use(requireAuth, dashboardRouter);
router.use(requireAuth, storageRouter);
router.use(requireAuth, subscriptionRouter);
router.use(requireAuth, contactsRouter);

export default router;
