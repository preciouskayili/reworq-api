import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { IntegrationModel } from "../models/Integrations";

const router = Router();

// GET /integrations - Get all user integrations
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user._id;
    const { name } = req.query as { name?: string };

    if (name) {
      const integration = await IntegrationModel.findOne({
        $and: [{ name: name }, { user_id: userId }],
      });
      if (!integration) {
        res.status(404).json({ message: "Integration not found" });
      } else {
        res.status(200).json({ integration });
      }
    } else {
      const integrations = await IntegrationModel.find({ user_id: userId });
      // Build flat key-value object: { google: 'xxx', slack: 'yyy', ... }
      const result: Record<string, any> = {};
      integrations.forEach((integration) => {
        if (integration.name) {
          result[integration.name] = integration;
        }
      });
      res.status(200).json(result);
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch integrations" });
  }
});

// PUT /integrations/:name - Update token for a given integration
router.put("/:name", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user._id;
    const { name } = req.params;
    const { access_token, refresh_token, expires_at } = req.body;

    const integration = await IntegrationModel.findOne({
      user_id: userId,
      name,
    });
    if (!integration) {
      res.status(404).json({ message: "Integration not found" });
    } else {
      if (access_token !== undefined) integration.access_token = access_token;
      if (refresh_token !== undefined)
        integration.refresh_token = refresh_token;
      if (expires_at !== undefined) integration.expires_at = expires_at;
      integration.updated_at = new Date();

      await integration.save();
      res.status(200).json(integration);
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to update integration token" });
  }
});

export default router;
