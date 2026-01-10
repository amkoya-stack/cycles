-- Migration 052: Add course lessons/modules support
-- Allow courses to have structured lessons with content

CREATE TABLE IF NOT EXISTS course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES classroom_courses(id) ON DELETE CASCADE,
  
  -- Lesson metadata
  title VARCHAR(255) NOT NULL,
  content TEXT, -- Text content for the lesson
  order_index INTEGER NOT NULL DEFAULT 0, -- Order within the course
  
  -- Optional: Link to media file for this lesson (if different from main course file)
  media_url TEXT,
  media_type VARCHAR(50), -- 'video', 'audio', 'pdf', 'text'
  
  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT unique_lesson_order_per_course UNIQUE (course_id, order_index, deleted_at)
);

-- Create indexes
CREATE INDEX idx_course_lessons_course_id ON course_lessons(course_id, deleted_at, order_index);
CREATE INDEX idx_course_lessons_order ON course_lessons(course_id, order_index);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_course_lessons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_course_lessons_timestamp
BEFORE UPDATE ON course_lessons
FOR EACH ROW
EXECUTE FUNCTION update_course_lessons_updated_at();

-- Enable RLS
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view lessons for courses in their chamas
CREATE POLICY view_course_lessons ON course_lessons
FOR SELECT
USING (
  course_id IN (
    SELECT id FROM classroom_courses
    WHERE chama_id IN (
      SELECT chama_id FROM chama_members 
      WHERE user_id = current_setting('app.user_id')::UUID 
      AND status = 'active'
    )
    AND deleted_at IS NULL
  )
  AND deleted_at IS NULL
);

-- RLS: Only admins can insert/update/delete lessons
CREATE POLICY insert_course_lessons ON course_lessons
FOR INSERT
WITH CHECK (
  course_id IN (
    SELECT c.id FROM classroom_courses c
    JOIN chama_members cm ON c.chama_id = cm.chama_id
    WHERE cm.user_id = current_setting('app.user_id')::UUID 
    AND cm.status = 'active'
    AND cm.role IN ('admin', 'secretary', 'treasurer')
    AND c.deleted_at IS NULL
  )
);

CREATE POLICY update_course_lessons ON course_lessons
FOR UPDATE
USING (
  course_id IN (
    SELECT c.id FROM classroom_courses c
    JOIN chama_members cm ON c.chama_id = cm.chama_id
    WHERE cm.user_id = current_setting('app.user_id')::UUID 
    AND cm.status = 'active'
    AND cm.role IN ('admin', 'secretary', 'treasurer')
    AND c.deleted_at IS NULL
  )
);

CREATE POLICY delete_course_lessons ON course_lessons
FOR UPDATE
USING (
  course_id IN (
    SELECT c.id FROM classroom_courses c
    JOIN chama_members cm ON c.chama_id = cm.chama_id
    WHERE cm.user_id = current_setting('app.user_id')::UUID 
    AND cm.status = 'active'
    AND cm.role IN ('admin', 'secretary', 'treasurer')
    AND c.deleted_at IS NULL
  )
)
WITH CHECK (
  deleted_at IS NOT NULL
);

