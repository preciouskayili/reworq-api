import { Response } from "express";
import GoogleService from "../../services/google";
import { AuthRequest } from "../../middleware/auth";
import { z } from "zod";
import { getDayBoundsInUTC } from "../../lib/utils";

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

export async function checkConflictController(req: AuthRequest, res: Response) {
  const { start, end } = req.body;

  const googleService = new GoogleService(req);

  const events = await googleService.checkConflict(start, end);
  res.json({
    conflict: events.length > 0,
    conflicting_events: events,
  });
}

export async function createEventController(req: AuthRequest, res: Response) {
  const {
    start_time,
    end_time,
    title,
    description,
    participants,
    location,
    reminders,
  } = req.body;

  const googleService = new GoogleService(req);

  const event = await googleService.createEvent({
    start_time,
    end_time,
    title,
    description,
    participants,
    location,
    reminders,
  });

  return res.json({
    success: true,
    event_id: event.id,
    meet_link: event.hangoutLink,
    start_time: event.start?.dateTime,
    end_time: event.end?.dateTime,
  });
}

export async function editEventController(req: AuthRequest, res: Response) {
  const parse = editEventSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({
      success: false,
      message: "Invalid payload",
      errors: z.treeifyError(parse.error),
    });
    return;
  }

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
    res.status(500).json({
      success: false,
      message: error.message || "Failed to edit event",
      event: null,
    });
  }
}

export async function deleteEventController(req: AuthRequest, res: Response) {
  try {
    const { event_id } = req.body;
    const googleService = new GoogleService(req);
    await googleService.deleteEvent(event_id);

    res.json({
      success: true,
      message: "Event deleted",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete event",
    });
  }
}

export async function fetchEventsController(req: AuthRequest, res: Response) {
  try {
    const { start_date, end_date } = req.body;

    if (!start_date) {
      return res.status(400).json({
        success: false,
        message: "start_date is required",
      });
    }

    const googleService = new GoogleService(req);
    const { timeMin } = getDayBoundsInUTC(start_date, "Africa/Lagos");
    const { timeMax } = getDayBoundsInUTC(end_date, "Africa/Lagos");

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
      events: formattedEvents,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch events",
      events: [],
    });
  }
}

export async function rescheduleEventController(
  req: AuthRequest,
  res: Response
) {
  const { event_id, new_start_time, new_end_time } = req.body;
  const googleService = new GoogleService(req);
  const updated = await googleService.rescheduleEvent(
    event_id,
    new_start_time,
    new_end_time
  );
  res.json({
    success: true,
    event_id: updated.id || event_id,
  });
}
