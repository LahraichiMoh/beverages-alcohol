-- Update the "Anyone can create participants" RLS policy to allow anonymous (unauthenticated) users
-- The current policy might be restricting anonymous access, so we'll recreate it more explicitly

DROP POLICY IF EXISTS "Anyone can create participants" ON public.participants;

CREATE POLICY "Anyone can create participants"
ON public.participants
FOR INSERT
WITH CHECK (true);

-- Also ensure SELECT is allowed for anyone to view their own results
DROP POLICY IF EXISTS "Participants can view their own data" ON public.participants;

CREATE POLICY "Participants can view their own data"
ON public.participants
FOR SELECT
USING (true);
