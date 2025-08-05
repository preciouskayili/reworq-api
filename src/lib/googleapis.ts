import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import { env } from "../config/env";
import { google } from "googleapis";
import { IntegrationModel } from "../models/Integrations";
import { AuthRequest } from "../middleware/auth";
dotenv.config();

const auth = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

export async function refreshAndSaveTokens(
  client: OAuth2Client,
  integration: any
) {
  client.on("tokens", async (tokens) => {
    const updates: any = {};
    if (tokens.access_token && tokens.access_token !== integration.access_token)
      updates.access_token = tokens.access_token;
    if (
      tokens.refresh_token &&
      tokens.refresh_token !== integration.refresh_token
    )
      updates.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) {
      const iso = new Date(tokens.expiry_date).toISOString();
      if (iso !== integration.expires_at?.toISOString())
        updates.expires_at = tokens.expiry_date;
    }

    if (Object.keys(updates).length) {
      updates.updated_at = new Date();
      await IntegrationModel.updateOne(
        { _id: integration._id },
        { $set: updates }
      );
    }
  });
}

/**
 * Get Google service for the authenticated user
 * @param req - The authenticated request object containing user information
 * @returns OAuth2Client configured with user's Google tokens
 */
export async function getGoogleService(req: AuthRequest) {
  // Ensure user is authenticated
  if (!req.user || !req.user._id) {
    throw new Error("User not authenticated");
  }

  const userId = req.user._id;

  const integration = await IntegrationModel.findOne({
    user_id: userId,
    name: "google",
  });

  if (!integration) throw new Error("No Google integration found");

  const client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  client.setCredentials({
    access_token: integration.access_token!,
    refresh_token: integration.refresh_token!,
    expiry_date: integration.expires_at
      ? new Date(integration.expires_at).getTime()
      : 0,
  });

  await refreshAndSaveTokens(client, integration);

  await client.getAccessToken();

  return client;
}

/**
 * Get Google service by user ID (for internal use only)
 * This function should only be used in contexts where you're certain
 * the user has permission to access the specified user's data
 * @param userId - The user ID to get Google service for
 * @param requestingUserId - The ID of the user making the request (for authorization)
 * @returns OAuth2Client configured with user's Google tokens
 */
export async function getGoogleServiceByUserId(
  userId: string,
  requestingUserId: string
) {
  // Authorization check: ensure the requesting user can only access their own data
  if (userId !== requestingUserId) {
    throw new Error("Unauthorized: Cannot access another user's integrations");
  }

  const integration = await IntegrationModel.findOne({
    user_id: userId,
    name: "google",
  });

  if (!integration) throw new Error("No Google integration found");

  const client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  client.setCredentials({
    access_token: integration.access_token!,
    refresh_token: integration.refresh_token!,
    expiry_date: integration.expires_at
      ? new Date(integration.expires_at).getTime()
      : 0,
  });

  await refreshAndSaveTokens(client, integration);

  await client.getAccessToken();

  return client;
}

export async function getGoogleOAuthUrl(scopes: string[], state?: string) {
  const url = auth.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state,
    prompt: "consent",
  });

  return url;
}

export async function getGoogleToken(code: string) {
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  return tokens;
}
