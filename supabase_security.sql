-- Run this in Supabase Dashboard -> SQL Editor.
-- This project is configured to use the "photo" bucket.
-- Do not run ALTER TABLE storage.objects; Supabase manages RLS for this table.
-- Remove conflicting INSERT, UPDATE, and DELETE policies in Storage -> Policies.

-- The "photo" bucket is public. Public object URLs do not require a SELECT policy.
-- Do not add a broad SELECT policy: it allows clients to list bucket contents.
-- The FastAPI backend uses the service-role key and owns file writes.

-- Remove the broad SELECT policy if it was created earlier.
drop policy if exists "Public read QR assets" on storage.objects;

drop policy if exists "Deny direct authenticated writes to QR assets" on storage.objects;
create policy "Deny direct authenticated writes to QR assets"
on storage.objects for insert
to authenticated
with check (false);

drop policy if exists "Deny direct authenticated updates to QR assets" on storage.objects;
create policy "Deny direct authenticated updates to QR assets"
on storage.objects for update
to authenticated
using (false)
with check (false);

drop policy if exists "Deny direct authenticated deletes from QR assets" on storage.objects;
create policy "Deny direct authenticated deletes from QR assets"
on storage.objects for delete
to authenticated
using (false);
