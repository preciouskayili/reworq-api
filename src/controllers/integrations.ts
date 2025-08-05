import { Response } from "express";
import { IntegrationModel } from "../models/Integrations";
import { AuthRequest } from "../middleware/auth";
import { authorizeUserAccess } from "../lib/utils";

export async function getIntegrationsController(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = req.user._id;
    const { name } = req.query as { name?: string };

    if (name) {
      const integration = await IntegrationModel.findOne({
        $and: [{ name: name }, { user_id: userId }],
      });
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      } else {
        return res.status(200).json({ integration });
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
      return res.status(200).json(result);
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateIntegrationController(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = req.user._id;
    const { name } = req.params;
    const { access_token, refresh_token, expires_at } = req.body;

    // Ensure user can only update their own integrations
    const integration = await IntegrationModel.findOne({
      user_id: userId,
      name,
    });

    if (!integration) {
      return res.status(404).json({ message: "Integration not found" });
    }

    // Additional authorization check using the utility function
    authorizeUserAccess(req, integration.user_id.toString());

    if (access_token !== undefined) integration.access_token = access_token;
    if (refresh_token !== undefined) integration.refresh_token = refresh_token;
    if (expires_at !== undefined) integration.expires_at = expires_at;
    integration.updated_at = new Date();

    await integration.save();
    return res.status(200).json(integration);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unauthorized")) {
      return res.status(403).json({ message: err.message });
    }
    return res
      .status(500)
      .json({ message: "Failed to update integration token" });
  }
}
