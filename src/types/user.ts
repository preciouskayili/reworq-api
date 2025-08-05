import { ObjectId } from "mongoose";

export type User = {
  _id: ObjectId;
  email: string;
  name?: string | null | undefined;
  googleId?: string | null | undefined;
  refreshToken?: string | null | undefined;
  magicLinkToken?: string | null | undefined;
  magicLinkExpires?: Date | null | undefined;
  timeZone?: string | null | undefined;
  workDayStart?: Date | null | undefined;
  workDayEnd?: Date | null | undefined;
  createdAt?: Date | null | undefined;
  updatedAt?: Date | null | undefined;
};
