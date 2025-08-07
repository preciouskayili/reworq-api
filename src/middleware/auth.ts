import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User";
import { env } from "../config/env";

export interface AuthRequest extends Request {
  user?: any;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid token" });
  } else {
    const token = authHeader.split("Bearer ")[1];

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as any;
      const user = await UserModel.findById(payload.userId);

      if (!user) {
        res.status(401).json({ message: "User not found" });
      } else {
        (req as AuthRequest).user = user;
        next();
      }
    } catch (err) {
      res.status(401).json({ message: "Invalid or expired token" });
    }
  }
}
