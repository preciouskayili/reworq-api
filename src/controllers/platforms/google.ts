import { Response } from "express";
import GoogleService from "../../services/google";
import { AuthRequest } from "../../middleware/auth";

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
