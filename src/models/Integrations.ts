import { model, Schema } from "mongoose";

export const IntegrationSchema = new Schema({
  name: { type: String, required: true },
  user_id: { type: String, required: true },
  access_token: { type: String, required: true },
  refresh_token: { type: String },
  expires_at: { type: Date },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  scope: { type: Schema.Types.Mixed },
});

export const IntegrationModel = model("Integration", IntegrationSchema);
