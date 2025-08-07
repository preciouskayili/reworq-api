import { Request, Response } from "express";
import { UserModel } from "../models/User";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { Resend } from "resend";
import { logger } from "../lib/logger";

const resend = new Resend(env.RESEND_API_KEY);

const magicLinkRequestSchema = z.object({
  email: z
    .email({
      message: "Invalid email address",
    })
    .min(1, "Email address is required"),
  name: z.string().optional(), // Name is optional for login, required for registration
});

export async function requestMagicLinkController(req: Request, res: Response) {
  const parsed = magicLinkRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.message });
  } else {
    const { email, name } = parsed.data;
    let user = await UserModel.findOne({ email });

    if (!user) {
      if (!name) {
        res.status(400).json({ message: "Name is required for new users." });
      } else {
        user = await UserModel.create({ email, name });
      }
    } else if (name && !user.name) {
      // Optionally update name if not set
      user.name = name;
      await user.save();
    }

    if (user) {
      // Generate a secure, time-limited token (JWT)
      const magicLinkToken = jwt.sign(
        { userId: user._id, type: "magic" },
        env.JWT_SECRET,
        { expiresIn: "15m" }
      );
      console.log("========================");
      console.log(env.JWT_SECRET);
      console.log("========================");

      user.magicLinkToken = magicLinkToken;
      user.magicLinkExpires = new Date(Date.now() + 15 * 60 * 1000);

      await user.save();

      // Send magic link email
      const magicLinkUrl = `${
        env.FRONTEND_URL || "http://localhost:3000"
      }/magic-link/verify?token=${magicLinkToken}`;

      try {
        await resend.emails.send({
          from: env.RESEND_FROM_EMAIL,
          to: email,
          subject: "Your Magic Login Link",
          html: `<p>Click <a href="${magicLinkUrl}">here</a> to log in. This link expires in 15 minutes.</p>`,
        });

        res.status(200).json({ message: "Magic link sent if email exists." });
      } catch (err) {
        res.status(500).json({ message: "Unable to send magic link" });
      }
    }
  }
}

export async function verifyMagicLinkController(req: Request, res: Response) {
  const { token } = req.body;

  if (!token) {
    res.status(400).json({ message: "Missing token" });
  } else {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId: string;
        type: string;
      };
      if (decoded.type !== "magic") {
        res.status(401).json({ message: "Invalid token type" });
      } else {
        const user = await UserModel.findOne({
          _id: decoded.userId,
          magicLinkToken: token,
        });

        if (
          !user ||
          !user.magicLinkExpires ||
          user.magicLinkExpires < new Date()
        ) {
          res.status(401).json({ message: "Invalid or expired magic link" });
        } else {
          user.magicLinkToken = undefined;
          user.magicLinkExpires = undefined;

          await user.save();

          // Issue access/refresh tokens
          const refreshToken = jwt.sign(
            { userId: user._id, type: "refresh" },
            env.JWT_SECRET,
            { expiresIn: "30d" }
          );

          user.refreshToken = refreshToken;

          await user.save();

          const tokenJwt = jwt.sign({ userId: user._id }, env.JWT_SECRET, {
            expiresIn: "15m",
          });

          res.status(200).json({
            token: tokenJwt,
            refreshToken,
            user: { email: user.email, name: user.name, id: user._id },
          });
        }
      }
    } catch (err) {
      console.log(err);
      res.status(401).json({ message: "Invalid or expired magic link" });
    }
  }
}

export async function refreshTokenController(req: Request, res: Response) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ message: "Missing refresh token" });
  } else {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== "refresh") {
        res.status(401).json({ message: "Invalid refresh token type" });
      } else {
        // Find user with this refresh token
        const user = await UserModel.findOne({
          _id: decoded.userId,
          refreshToken,
        });

        if (!user) {
          res.status(401).json({ message: "Invalid refresh token" });
        } else {
          // Issue new access token
          const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, {
            expiresIn: "15m",
          });
          res.status(200).json({ token });
        }
      }
    } catch (err) {
      res.status(401).json({ message: "Invalid or expired refresh token" });
    }
  }
}
