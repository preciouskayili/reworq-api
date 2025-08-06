import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  checkConflictController,
  createEventController,
  editEventController,
  deleteEventController,
  fetchEventsController,
  rescheduleEventController,
} from "../controllers/platforms/google";

const router = Router();

router.use(requireAuth);

router.post("/check-conflict", checkConflictController);
router.post("/create-event", createEventController);
router.post("/edit-event", editEventController);
router.delete("/delete-event", deleteEventController);
router.post("/fetch-events", fetchEventsController);
router.post("/reschedule-event", rescheduleEventController);

export default router;
