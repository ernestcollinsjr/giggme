# Consolidate Roles to 4

Replace the current 7-role system with: **super_admin**, **booking_manager**, **admin**, **entertainer**. This is large and ripples through DB, RLS, edge functions, and UI. I'll do it in 3 phases so we can verify each step before moving on.

## Role mapping

| Old role | New role |
|---|---|
| super_admin | super_admin |
| booking_manager | booking_manager |
| band_leader | booking_manager |
| venue_owner | booking_manager |
| band_member | entertainer |
| artist | entertainer |
| tour_manager | entertainer |

**Admin** is new. Granted by a booking manager. Scoped to one BM's roster only — can edit artist profiles, gigs, groups, send messages on that BM's behalf. **Cannot** delete the BM's account, change billing, or touch other BMs' data.

**Entertainer** requires an active subscription (existing `entertainer_subscribers` table). Without one: profile hidden from Discover, can't accept bookings, blocked from entertainer-only screens with an upgrade prompt.

## Phase 1 — Database (migration)

1. Add new enum values to `app_role`: `admin` (entertainer already exists in some form via `artist`? — actually no; we add `entertainer` too). Keep old values in the enum for now (Postgres can't drop enum values safely) — just stop assigning them.
2. New table `booking_manager_admins`:
   ```
   booking_manager_id uuid, admin_user_id uuid, created_at,
   PRIMARY KEY (booking_manager_id, admin_user_id)
   ```
   RLS: BM can manage their own admins; admin can view their own link.
3. New security-definer functions:
   - `is_admin_for(_admin_id, _booking_manager_id) returns boolean`
   - `is_entertainer_subscribed(_user_id) returns boolean` (checks `entertainer_subscribers.status = 'active'`)
   - Update `get_user_role()` to return one of the 4 new values (collapsing old values via mapping).
4. Data backfill on `user_roles`:
   - `band_leader`, `venue_owner` → `booking_manager`
   - `band_member`, `artist`, `tour_manager` → `entertainer`
   - dedupe so no user has the same role twice.
5. Rewrite every RLS policy that references the old role names. Major tables: `gigs`, `gig_members`, `bands`, `band_members`, `availability_*`, `member_availability`, `entertainment_bookings`, `booking_manager_artists`, `booking_manager_bands`, `member_groups`, `profiles`, `tours`, `tour_crew_members`. Replace `has_role(_, 'band_leader')` → `has_role(_, 'booking_manager')`, etc. Add admin-scoped policies using `is_admin_for(...)` so admins inherit their BM's write access on the BM's roster artists, gigs, groups.
6. `handle_new_user()` trigger: clamp incoming role to the 4 valid values; default unknown to `entertainer`.

## Phase 2 — App code

1. **Role type** (`src/lib/roles.ts` new): export `AppRole = 'super_admin' | 'booking_manager' | 'admin' | 'entertainer'` and a helper `normalizeRole()` mapping legacy values for any cached/stale data.
2. **ProfileSetup**: collapse role-picker to the 4 options. Hide `admin` from self-signup (admins are invited by a BM).
3. **Dashboard routing** (`src/pages/Dashboard.tsx`): replace all `band_leader` / `band_member` / `artist` / `tour_manager` / `venue_owner` checks with the new 4. Admin gets the BM dashboard but with destructive actions (delete account, billing) hidden.
4. **BottomNav** + **TopNav**: update role-conditional nav items.
5. **Admin invite UI** on `BookingManagerAdmin`: new "Admins" panel where BM can invite an existing user as their admin (email lookup → insert into `booking_manager_admins`). Includes remove button.
6. **Entertainer subscription gate**: middleware/hook `useEntertainerAccess()` — if role is entertainer and not subscribed, redirect entertainer-only routes to an upgrade screen. Discover already filters by `entertainer_subscribers.status='active'` via `get_featured_entertainers` — extend `get_public_performers()` similarly.
7. **Search/replace sweep** for hardcoded old role strings across `src/` (~40 files expected).

## Phase 3 — Cleanup & verify

1. Hide unused role labels from any settings/admin screens.
2. Run security linter; fix any new warnings introduced by RLS changes.
3. Smoke test the 4 user journeys: super_admin (you), a BM, a BM's admin, a subscribed entertainer, a lapsed entertainer.

## What I will NOT do in this plan

- Delete the old enum values (Postgres limitation; harmless to leave).
- Touch billing/Stripe pricing — entertainer subscription flow already exists.
- Build a new invite-by-email edge function for admins; v1 requires the target user to already have an account, then BM links them by email.

## Suggested order of execution

I'll do Phase 1 (one migration) → ask you to verify nobody got logged out / lost access → Phase 2 → Phase 3. If you'd rather I push straight through all three, say so.

Approve and I'll start with the migration.