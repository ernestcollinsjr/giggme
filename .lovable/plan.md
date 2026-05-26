## 2-Hour Booking Response Timer

When a booker sends a request, the performer has **2 hours** to accept or decline. If the timer runs out, the system auto-declines and emails the booker so they can find someone else.

### 1. New table: `booking_requests`
Stores each request with: booker, performer, gig details (dates, venue, phone, budget, contact, dress code, note), status (`pending` / `accepted` / `declined` / `expired`), `expires_at` (now + 2h), and `responded_at`. RLS so booker and performer can each see their own.

### 2. Updated booking flow
When "Send Booking Request" is clicked:
- A `booking_requests` row is created with a 2-hour expiry
- The performer email now includes **Accept** and **Decline** buttons (in addition to "Reply in GigGme") that deep-link into the app
- The booker receives a confirmation email noting the 2-hour window

### 3. Performer response page (`/booking-request/:id`)
- Shows gig details and a live countdown to expiry
- Accept / Decline buttons update the request status
- Accepting sends a confirmation email to the booker; declining sends a decline email
- Already-responded or expired requests show a clear status message

### 4. Auto-expire job
- New edge function `expire-booking-requests` finds pending requests past `expires_at`, marks them `expired`, and emails the booker: *"Your request to [performer] expired with no response — find another performer."*
- Scheduled via `pg_cron` to run every minute

### 5. Booker visibility
Booking Manager dashboard gets a small "My Booking Requests" list showing status of each sent request (pending with countdown, accepted, declined, expired).

### Technical notes
- All emails use the existing Resend setup (`send-booking-request-email` extended, plus new `send-booking-response-email` and `send-booking-expired-email` — or one generic function with a `type` field; I'll go with one generic function to keep it simple)
- Status transitions are guarded server-side so an expired request can't be accepted after the fact
- `expires_at` is the source of truth; the UI countdown is cosmetic