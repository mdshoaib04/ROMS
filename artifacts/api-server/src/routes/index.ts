import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clientsRouter from "./clients";
import agenciesRouter from "./agencies";
import releaseOrdersRouter from "./releaseOrders";
import playoutReportsRouter from "./playoutReports";
import invoicesRouter from "./invoices";
import paymentsRouter from "./payments";
import dashboardRouter from "./dashboard";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(clientsRouter);
router.use(agenciesRouter);
router.use(releaseOrdersRouter);
router.use(playoutReportsRouter);
router.use(invoicesRouter);
router.use(paymentsRouter);
router.use(dashboardRouter);
router.use(notificationsRouter);

export default router;
