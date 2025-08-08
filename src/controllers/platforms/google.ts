import { Response } from "express";
import GoogleService from "../../services/google";
import { AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { getDayBoundsInUTC } from "../../lib/utils";

function formatZodError(error: z.ZodError) {
  const flattened = z.treeifyError(error);
  return {
    message: "Invalid request payload",
    ...flattened,
  };
}

const checkConflictSchema = z.object({
  start: z.string().min(1, "start is required"),
  end: z.string().min(1, "end is required"),
});

const createEventSchema = z.object({
  start_time: z.string().min(1, "start_time is required"),
  end_time: z.string().min(1, "end_time is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  participants: z.array(z.email()).optional(),
  location: z.string().optional(),
  reminders: z.any().optional(),
});

const editEventSchema = z.object({
  event_id: z.string().min(1, "Event ID is required"),
  changes: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    add_participants: z.array(z.email()).optional(),
    remove_participants: z.array(z.email()).optional(),
    add_meet_link: z.boolean().optional(),
  }),
});

const deleteEventSchema = z.object({
  event_id: z.string().min(1, "Event ID is required"),
});

const fetchEventsSchema = z.object({
  start_date: z.coerce.date("Invalid date"),
  end_date: z.coerce.date().optional(),
});

const rescheduleEventSchema = z.object({
  event_id: z.string().min(1, "Event ID is required"),
  new_start_time: z.string().min(1, "new_start_time is required"),
  new_end_time: z.string().min(1, "new_end_time is required"),
});

export async function checkConflictController(req: AuthRequest, res: Response) {
  const parsed = checkConflictSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, ...formatZodError(parsed.error) });
  } else {
    const { start, end } = parsed.data;
    const googleService = new GoogleService(req);

    try {
      const events = await googleService.checkConflict(start, end);
      res.json({
        success: true,
        conflict: events.length > 0,
        conflicting_events: events,
      });
    } catch (error: any) {
      const message =
        error?.message === "Google client not initialized"
          ? "Google is not connected for this user"
          : "Unable to check for conflicts";
      res.status(400).json({ success: false, message });
    }
  }
}

export async function createEventController(req: AuthRequest, res: Response) {
  const parsed = createEventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, ...formatZodError(parsed.error) });
  } else {
    const {
      start_time,
      end_time,
      title,
      description,
      participants,
      location,
      reminders,
    } = parsed.data;

    const googleService = new GoogleService(req);

    try {
      const event = await googleService.createEvent({
        start_time,
        end_time,
        title,
        description,
        participants,
        location,
        reminders,
      });

      res.json({
        success: true,
        event_id: event.id,
        meet_link: event.hangoutLink,
        start_time: event.start?.dateTime,
        end_time: event.end?.dateTime,
      });
    } catch (error: any) {
      const message =
        error?.message === "Google client not initialized"
          ? "Google is not connected for this user"
          : "Unable to create event";
      console.log(error);

      res.status(400).json({ success: false, message });
    }
  }
}

export async function editEventController(req: AuthRequest, res: Response) {
  const parse = editEventSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({
      success: false,
      ...formatZodError(parse.error),
    });
  } else {
    const { event_id, changes } = parse.data;
    const googleService = new GoogleService(req);

    try {
      const payload: any = {};
      const updated_fields: string[] = [];

      if (changes.title) {
        payload.summary = changes.title;
        updated_fields.push("title");
      }

      if (changes.description) {
        payload.description = changes.description;
        updated_fields.push("description");
      }

      if (changes.add_meet_link) {
        payload.conferenceData = {
          createRequest: {
            requestId: `meet-${event_id}-${Date.now()}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        };
        updated_fields.push("meeting_link");
      }

      const hasParticipants =
        changes.add_participants || changes.remove_participants;

      if (hasParticipants) {
        const event = await googleService.fetchEvents({ eventId: event_id });
        const singleEvent = Array.isArray(event) ? event[0] : event;

        let attendees = Array.isArray(singleEvent?.attendees)
          ? [...singleEvent.attendees]
          : [];

        if (changes.remove_participants) {
          attendees = attendees.filter((attendee) => {
            const email =
              typeof attendee === "string" ? attendee : attendee?.email;
            return email && !changes.remove_participants!.includes(email);
          });
        }

        if (changes.add_participants) {
          const existingEmails = new Set(
            attendees
              .map((attendee) =>
                typeof attendee === "string" ? attendee : attendee?.email
              )
              .filter(Boolean)
          );

          for (const email of changes.add_participants) {
            if (!existingEmails.has(email)) {
              attendees.push({ email });
            }
          }
        }

        payload.attendees = attendees;
        updated_fields.push("participants");
      }

      const updated = await googleService.editEvent(event_id, payload);

      res.json({
        success: true,
        event_id: updated.id || event_id,
        updated_fields,
        meet_link:
          updated.hangoutLink || updated.conferenceData?.entryPoints?.[0]?.uri,
      });
    } catch (error: any) {
      const message =
        error?.message === "Google client not initialized"
          ? "Google is not connected for this user"
          : "Failed to edit event";
      res.status(400).json({
        success: false,
        message,
        event: null,
      });
    }
  }
}

export async function deleteEventController(req: AuthRequest, res: Response) {
  const parsed = deleteEventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, ...formatZodError(parsed.error) });
  } else {
    try {
      const { event_id } = parsed.data;
      const googleService = new GoogleService(req);
      await googleService.deleteEvent(event_id);

      res.json({
        success: true,
        message: "Event deleted",
      });
    } catch (error: any) {
      const message =
        error?.message === "Google client not initialized"
          ? "Google is not connected for this user"
          : "Failed to delete event";
      res.status(400).json({ success: false, message });
    }
  }
}

export async function fetchEventsController(req: AuthRequest, res: Response) {
  const parsed = fetchEventsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, ...formatZodError(parsed.error) });
  } else {
    try {
      const { start_date, end_date } = parsed.data;
      const googleService = new GoogleService(req);

      const { timeMin } = getDayBoundsInUTC(start_date, "Africa/Lagos");
      let timeMax: string;
      if (end_date) {
        timeMax = getDayBoundsInUTC(end_date, "Africa/Lagos").timeMax;
      } else {
        timeMax = getDayBoundsInUTC(start_date, "Africa/Lagos").timeMax;
      }

      const events = await googleService.fetchEvents({
        timeMin,
        timeMax,
      });

      const formattedEvents = (events || []).map((event: any) => ({
        event_id: event.id,
        title: event.summary || "",
        description: event.description || "",
        start_time: event.start?.dateTime || event.start?.date || "",
        end_time: event.end?.dateTime || event.end?.date || "",
        attendees: (event.attendees || []).map((a: any) => a.email),
      }));

      res.json({
        success: true,
        events: formattedEvents,
      });
    } catch (error: any) {
      const message =
        error?.message === "Google client not initialized"
          ? "Google is not connected for this user"
          : "Failed to fetch events";
      res.status(400).json({ success: false, message, events: [] });
    }
  }
}

export async function rescheduleEventController(
  req: AuthRequest,
  res: Response
) {
  const parsed = rescheduleEventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, ...formatZodError(parsed.error) });
  } else {
    const { event_id, new_start_time, new_end_time } = parsed.data;
    const googleService = new GoogleService(req);
    try {
      const updated = await googleService.rescheduleEvent(
        event_id,
        new_start_time,
        new_end_time
      );
      res.json({
        success: true,
        event_id: updated.id || event_id,
      });
    } catch (error: any) {
      const message =
        error?.message === "Google client not initialized"
          ? "Google is not connected for this user"
          : "Failed to reschedule event";
      res.status(400).json({ success: false, message });
    }
  }
}
