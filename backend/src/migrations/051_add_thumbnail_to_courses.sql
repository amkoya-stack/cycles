-- Migration 051: Add thumbnail support to classroom courses
-- Allow courses to have optional thumbnail images

ALTER TABLE classroom_courses
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_classroom_courses_thumbnail ON classroom_courses(thumbnail_url) WHERE thumbnail_url IS NOT NULL;

