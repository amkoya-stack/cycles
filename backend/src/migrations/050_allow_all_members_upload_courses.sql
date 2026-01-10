-- Migration 050: Allow all members to upload courses (not just admins)
-- Update RLS policies to allow all active members to insert courses

-- Drop the old insert policy
DROP POLICY IF EXISTS insert_chama_courses ON classroom_courses;

-- Create new policy: All active members can insert courses
CREATE POLICY insert_chama_courses ON classroom_courses
FOR INSERT
WITH CHECK (
  chama_id IN (
    SELECT chama_id FROM chama_members 
    WHERE user_id = current_setting('app.user_id')::UUID 
    AND status = 'active'
  )
);


