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

// Preemptive refresh window to avoid near-expiry race conditions
const TOKEN_SKEW_MS = 5 * 60 * 1000;

async function ensureFreshAccessToken(client: OAuth2Client, integration: any) {
  const now = Date.now();
  const exp = integration.expires_at
    ? new Date(integration.expires_at).getTime()
    : 0;

  if (!exp || exp - now <= TOKEN_SKEW_MS) {
    try {
      await client.getAccessToken();
    } catch (err: any) {
      // If refresh fails due to revocation, keep DB consistent and rethrow
      if (err?.response?.data?.error === "invalid_grant") {
        await IntegrationModel.updateOne(
          { _id: integration._id },
          { $set: { updated_at: new Date() } }
        );
      }
      throw err;
    }
  }
}

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
      const asDate = new Date(tokens.expiry_date);
      const iso = asDate.toISOString();
      if (iso !== integration.expires_at?.toISOString())
        updates.expires_at = asDate;
    }

    if (Object.keys(updates).length) {
      updates.updated_at = new Date();
      await IntegrationModel.updateOne(
        { _id: integration._id },
        { $set: updates }
      );
      // Keep in-memory copy updated during this request lifecycle
      Object.assign(integration, updates);
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
  await ensureFreshAccessToken(client, integration);

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
  await ensureFreshAccessToken(client, integration);

  return client;
}

export async function getGoogleOAuthUrl(scopes: string[], state?: string) {
  const url = auth.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state,
    prompt: "consent",
    include_granted_scopes: true,
  });

  return url;
}

export async function getGoogleToken(code: string) {
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  return tokens;
}
