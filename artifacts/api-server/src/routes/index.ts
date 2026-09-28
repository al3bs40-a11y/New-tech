import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import newtechRouter from "./newtech";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(storageRouter);
router.use(newtechRouter);

export default router;
