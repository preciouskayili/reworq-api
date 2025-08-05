import { RequestHandler, Router } from "express";
import oauthRouter from "./oauth/index";
import authRouter from "./auth.ts";
import integrationsRouter from "./integrations";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Hello from Worqai API" });
});
router.use("/auth", authRouter);
router.use("/oauth", requireAuth, oauthRouter);
router.use("/integrations", requireAuth, integrationsRouter);

export default router;
