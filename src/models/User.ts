import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    refreshToken: { type: String },
    magicLinkToken: { type: String },
    magicLinkExpires: { type: Date },
    timeZone: { type: String },
    workDayStart: { type: Date },
    workDayEnd: { type: Date },
  },
  { timestamps: true }
);

export const UserModel = model("User", UserSchema);
