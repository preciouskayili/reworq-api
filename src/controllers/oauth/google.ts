import { Request, Response } from "express";
import { getGoogleOAuthUrl, getGoogleToken } from "../../lib/googleapis.ts";
import { IntegrationModel } from "../../models/Integrations.ts";
import { AuthRequest } from "../../middleware/auth";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/* ---------- Step 1: build consent-screen URL ---------- */
export async function getGoogleOAuthUrlController(
  req: AuthRequest,
  res: Response
) {
  const userId = req.user._id; // session / JWT
  const exists = await IntegrationModel.exists({
    user_id: userId,
    name: "google",
  });

  if (exists) {
    res.status(409).json({ message: "Google already connected" });
  } else {
    // No state needed, just build the consent URL
    const url = await getGoogleOAuthUrl(SCOPES);
    res.json({ url });
  }
}

/* ---------- Step 2: handle Google's redirect ---------- */
export async function googleCallbackController(
  req: AuthRequest,
  res: Response
) {
  const { code } = req.query as Record<string, string>;
  if (!code) {
    res.status(400).json({ message: "Missing code" });
  } else {
    const userId = req.user._id;
    const alreadyExists = await IntegrationModel.exists({
      user_id: userId,
      name: "google",
    });

    if (alreadyExists) {
      res.status(409).json({ message: "Google Account already connected" });
    } else {
      const tokens = await getGoogleToken(code!);

      await IntegrationModel.create({
        name: "google",
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date,
      });

      res.status(200).json({
        message: "Google Account connected successfully",
      });
    }
  }
}
