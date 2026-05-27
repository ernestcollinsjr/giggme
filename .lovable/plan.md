## Goal
Add two capabilities to the gig tracking system:
1. **Push + email reminders** — fire automatically before each gig so artists/managers don't need the app open.
2. **Persist "in transit" state** — when someone taps Navigate, record it so others on the gig can see who's en route.

---

## 1. Persist "in transit" state

### New table: `gig_travel_status`
- `gig_id` (uuid) + `user_id` (uuid) composite key
- `status` text: `not_started` | `in_transit` | `arrived`
- `started_at`, `arrived_at` timestamps
- `source` text: `gig` or `booking_request` (so we can key off either)
- RLS: a user can upsert their own row; gig owner, band members, and managing booking managers can read all rows for that gig.

### UI changes in `UpcomingGigLocationTracker.tsx`
- When user clicks **Navigate**, upsert their row to `in_transit` before opening Maps.
- Add a small **"I've arrived"** button that flips to `arrived`.
- Subscribe via Supabase Realtime to `gig_travel_status` for the visible gig and render avatars/initials with a status dot ("On the way" / "Arrived") below the card.
- Booking manager view shows everyone's status; artist view shows their own + bandmates.

---

## 2. Push + email reminders

Use the existing email queue infrastructure + `push_tokens` table already in the project (VAPID keys are configured).

### New edge function: `send-gig-reminders`
Runs on cron, scans for gigs/booking_requests where:
- `event_date` is within the next **3 hours** AND
- a reminder of that tier hasn't been sent yet.

Three reminder tiers, tracked with new columns on `gigs` and `booking_requests`:
- `reminder_24h_sent_at`
- `reminder_3h_sent_at`
- `reminder_30m_sent_at`

For each due reminder:
- Look up recipients: gig owner + accepted `gig_members` + managing booking managers (via `booking_manager_artists` / `booking_manager_bands`).
- For each recipient with a `push_tokens` row → send web push ("Gig at Donatello in 3 hours — tap to navigate").
- For each recipient → enqueue transactional email via existing `send-transactional-email` flow with venue, time, and a deep link to the navigation card.
- Stamp the appropriate `reminder_*_sent_at` column so it doesn't double-fire.

### Cron schedule
- `pg_cron` job every 5 minutes calling `send-gig-reminders` (uses `net.http_post`, follows the existing `send_gig_reminders()` pattern already in the DB).

### Notification preferences
- Respect existing `notification_preferences` table (`push_enabled`, `email_enabled`, `reminder_day_of`, etc.).

---

## Files touched

**New**
- `supabase/functions/send-gig-reminders/index.ts`
- Migration: `gig_travel_status` table + RLS + grants, reminder timestamp columns on `gigs` / `booking_requests`, cron job.

**Modified**
- `src/components/UpcomingGigLocationTracker.tsx` — Navigate writes `in_transit`, adds "Arrived" button, shows party status list with realtime subscription.

---

## Out of scope (ask if you want them)
- SMS reminders (Twilio is configured but would add cost per send)
- "Running late" toggle that notifies the rest of the band
- Map view showing live positions of all party members

---

## Open questions before I build

1. **Reminder tiers** — is 24h / 3h / 30m right, or do you want a different cadence (e.g., 2h / 1h / 15m)?
2. **Who sees travel status?** — should the artist see other band members' status too, or only the booking manager sees the full party?
3. **Auto-arrived?** — should we auto-flip to "arrived" using geolocation proximity (we already have `venue_lat`/`venue_lng`), or keep it a manual button?