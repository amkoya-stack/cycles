-- Migration 053: Add course progress tracking
-- Track user progress through courses and lessons

CREATE TABLE IF NOT EXISTS course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES classroom_courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Progress tracking
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_accessed_lesson_id UUID REFERENCES course_lessons(id) ON DELETE SET NULL,
  last_accessed_at TIMESTAMPTZ,
  
  -- Completion tracking
  completed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user_course_progress UNIQUE (course_id, user_id)
);

-- Create indexes
CREATE INDEX idx_course_progress_user ON course_progress(user_id);
CREATE INDEX idx_course_progress_course ON course_progress(course_id);
CREATE INDEX idx_course_progress_user_course ON course_progress(user_id, course_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_course_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_course_progress_timestamp
BEFORE UPDATE ON course_progress
FOR EACH ROW
EXECUTE FUNCTION update_course_progress_updated_at();

-- Enable RLS
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own progress
CREATE POLICY view_own_progress ON course_progress
FOR SELECT
USING (
  user_id = current_setting('app.user_id')::UUID
  OR course_id IN (
    SELECT id FROM classroom_courses
    WHERE chama_id IN (
      SELECT chama_id FROM chama_members 
      WHERE user_id = current_setting('app.user_id')::UUID 
      AND status = 'active'
    )
  )
);

-- RLS: Users can insert/update their own progress
CREATE POLICY manage_own_progress ON course_progress
FOR ALL
USING (user_id = current_setting('app.user_id')::UUID)
WITH CHECK (user_id = current_setting('app.user_id')::UUID);

-- Table to track lesson completion
CREATE TABLE IF NOT EXISTS lesson_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Completion tracking
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  time_spent_seconds INTEGER DEFAULT 0, -- Time spent on this lesson
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user_lesson_completion UNIQUE (lesson_id, user_id)
);

-- Create indexes
CREATE INDEX idx_lesson_completion_user ON lesson_completion(user_id);
CREATE INDEX idx_lesson_completion_lesson ON lesson_completion(lesson_id);
CREATE INDEX idx_lesson_completion_user_lesson ON lesson_completion(user_id, lesson_id);

-- Enable RLS
ALTER TABLE lesson_completion ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own lesson completions
CREATE POLICY view_own_lesson_completion ON lesson_completion
FOR SELECT
USING (
  user_id = current_setting('app.user_id')::UUID
  OR lesson_id IN (
    SELECT id FROM course_lessons
    WHERE course_id IN (
      SELECT id FROM classroom_courses
      WHERE chama_id IN (
        SELECT chama_id FROM chama_members 
        WHERE user_id = current_setting('app.user_id')::UUID 
        AND status = 'active'
      )
    )
  )
);

-- RLS: Users can insert their own lesson completions
CREATE POLICY manage_own_lesson_completion ON lesson_completion
FOR ALL
USING (user_id = current_setting('app.user_id')::UUID)
WITH CHECK (user_id = current_setting('app.user_id')::UUID);

