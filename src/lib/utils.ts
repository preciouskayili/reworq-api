import { IntegrationModel } from "../models/Integrations";
import { AuthRequest } from "../middleware/auth";

export function getDayBoundsInUTC(date: Date, timeZone: string) {
  const localeDate = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  const [month, day, year] = localeDate.split("/");

  // Get start and end of day in user's time zone
  const startLocal = new Date(`${year}-${month}-${day}T00:00:00`);
  const endLocal = new Date(`${year}-${month}-${day}T23:59:59.999`);

  // Convert to UTC manually
  const utcStart = new Date(
    startLocal.toLocaleString("en-US", { timeZone: "UTC", hour12: false })
  );
  const utcEnd = new Date(
    endLocal.toLocaleString("en-US", { timeZone: "UTC", hour12: false })
  );

  return { timeMin: utcStart.toISOString(), timeMax: utcEnd.toISOString() };
}

export async function getIntegration(userId: string, name: string) {
  return IntegrationModel.findOne({ user_id: userId, name }).lean();
}

/**
 * Authorization utility to ensure users can only access their own resources
 * @param req - The authenticated request object
 * @param resourceUserId - The user ID of the resource being accessed
 * @returns true if authorized, throws error if not
 */
export function authorizeUserAccess(
  req: AuthRequest,
  resourceUserId: string
): boolean {
  if (!req.user || !req.user._id) {
    throw new Error("User not authenticated");
  }

  if (req.user._id.toString() !== resourceUserId.toString()) {
    throw new Error("Unauthorized: Cannot access another user's resources");
  }

  return true;
}

/**
 * Authorization utility for admin access (if you have admin roles)
 * @param req - The authenticated request object
 * @returns true if user is admin, throws error if not
 */
export function authorizeAdminAccess(req: AuthRequest): boolean {
  if (!req.user || !req.user._id) {
    throw new Error("User not authenticated");
  }

  // Add your admin role check logic here
  // For example: if (!req.user.isAdmin) throw new Error("Admin access required");

  return true;
}
