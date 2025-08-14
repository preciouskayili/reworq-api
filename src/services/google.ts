import { OAuth2Client } from "google-auth-library";
import { calendar_v3, google } from "googleapis";
import { env } from "../config/env";
import { getGoogleService } from "../lib/googleapis";
import { logger } from "../lib/logger";
import { AuthRequest } from "../middleware/auth";

class GoogleService {
  private req: AuthRequest;

  constructor(req: AuthRequest) {
    this.req = req;
  }

  async googleService() {
    return await getGoogleService(this.req);
  }

  /**
   * Checks for conflicting events in the user's primary Google Calendar.
   * @param start - The start time of the event (ISO string or Date).
   * @param end - The end time of the event (ISO string or Date).
   * @returns An array of conflicting events, or an empty array if none found.
   */
  async checkConflict(start: string | Date, end: string | Date) {
    const client = await this.googleService();
    const calendar = google.calendar({ version: "v3", auth: client });

    const startTime = new Date(start);
    const endTime = new Date(end);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items || [];
    const conflicts: calendar_v3.Schema$Event[] = [];

    for (const event of events) {
      if (event.status === "cancelled") continue;

      const eventStart = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : null;

      const eventEnd = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : null;

      if (!eventStart || !eventEnd) continue;

      if (eventStart < endTime && startTime < eventEnd) {
        conflicts.push({
          id: event.id,
          summary: event.summary,
          start: {
            dateTime: eventStart.toISOString(),
          },
          end: {
            dateTime: eventEnd.toISOString(),
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Creates a new event in the user's primary Google Calendar.
   * @param eventData - The event details (summary, description, start, end, etc.)
   */
  async createEvent(eventData: any) {
    const client = await this.googleService();
    const calendar = google.calendar({ version: "v3", auth: client });

    const {
      start_time,
      end_time,
      title,
      description,
      participants,
      location,
      reminders,
      ...rest
    } = eventData || {};

    let requestBody: any = {
      summary: title,
      description,
      start: start_time ? { dateTime: start_time } : undefined,
      end: end_time ? { dateTime: end_time } : undefined,
      attendees: Array.isArray(participants)
        ? participants.map((email: string) => ({ email }))
        : undefined,
      // Only set a physical location if it's not the special "google meet" marker
      location:
        typeof location === "string" &&
        location.trim().toLowerCase() !== "google meet"
          ? location
          : undefined,
      reminders,
      ...rest,
    };

    if (
      typeof location === "string" &&
      location.trim().toLowerCase() === "google meet"
    ) {
      requestBody = {
        ...requestBody,
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.floor(
              Math.random() * 10000
            )}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      };
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody,
      conferenceDataVersion:
        requestBody.conferenceData !== undefined ? 1 : undefined,
    });

    return res.data;
  }

  /**
   * Edits an existing event in the user's primary Google Calendar.
   * @param eventId - The ID of the event to edit.
   * @param updates - The updated event details.
   */
  async editEvent(eventId: string, updates: any) {
    const client = await this.googleService();
    const calendar = google.calendar({ version: "v3", auth: client });
    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: updates,
    });
    return res.data;
  }

  /**
   * Deletes an event from the user's primary Google Calendar.
   * @param eventId - The ID of the event to delete.
   */
  async deleteEvent(eventId: string) {
    const client = await this.googleService();
    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });

    return { success: true };
  }

  /**
   * Fetches events from the user's primary Calendar using the eventId
   * @param eventId - The ID of the event to fetch.
   */
  async fetchEvent(eventId: string) {
    const client = await this.googleService();
    const calendar = google.calendar({ version: "v3", auth: client });
    const res = await calendar.events.get({
      calendarId: "primary",
      eventId,
    });
    return res.data;
  }

  /**
   * Fetches events from the user's primary Google Calendar.
   * @param params - Optional query parameters (e.g., timeMin, timeMax, maxResults)
   */
  async fetchEvents(params: any = {}) {
    const client = await this.googleService();
    const calendar = google.calendar({ version: "v3", auth: client });
    const res = await calendar.events.list({
      calendarId: "primary",
      ...params,
    });

    return res.data.items || [];
  }

  /**
   * Reschedules an event by updating its start and end times.
   * @param eventId - The ID of the event to reschedule.
   * @param newStart - The new start time (RFC3339 string or Date object).
   * @param newEnd - The new end time (RFC3339 string or Date object).
   */
  async rescheduleEvent(
    eventId: string,
    newStart: string | Date,
    newEnd: string | Date
  ) {
    const client = await this.googleService();
    const calendar = google.calendar({ version: "v3", auth: client });

    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: {
        start: {
          dateTime:
            typeof newStart === "string" ? newStart : newStart.toISOString(),
        },
        end: {
          dateTime: typeof newEnd === "string" ? newEnd : newEnd.toISOString(),
        },
      },
    });

    return res.data;
  }
}

export default GoogleService;
