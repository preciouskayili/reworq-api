import { Types } from "mongoose";

export type Integration = {
  name: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
  scope?: any;
};

export type TIntegrations = Record<string, Integration>;
