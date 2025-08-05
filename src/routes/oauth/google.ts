import {
  getGoogleOAuthUrlController,
  googleCallbackController,
} from "../../controllers/oauth/google";
import { Router } from "express";
import { requireAuth } from "../../middleware/auth";

const router = Router();

// Integration (connect Google to existing user)
router.get("/", requireAuth, getGoogleOAuthUrlController);
router.get("/callback", requireAuth, googleCallbackController);

export default router;
