-- Migration 049: Classroom courses system
-- Allow chamas to upload and manage educational courses (PDF, audio, video)

-- Course file types enum
CREATE TYPE course_file_type AS ENUM ('pdf', 'audio', 'video');

-- Classroom courses table
CREATE TABLE IF NOT EXISTS classroom_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Course metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_type course_file_type NOT NULL,
  
  -- File info
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL, -- Local storage or S3/R2 URL
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT unique_course_title_per_chama UNIQUE (chama_id, title, deleted_at)
);

-- Create indexes for performance
CREATE INDEX idx_classroom_courses_chama_id ON classroom_courses(chama_id, deleted_at DESC);
CREATE INDEX idx_classroom_courses_uploaded_by ON classroom_courses(uploaded_by);
CREATE INDEX idx_classroom_courses_file_type ON classroom_courses(file_type);
CREATE INDEX idx_classroom_courses_created_at ON classroom_courses(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_classroom_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_classroom_courses_timestamp
BEFORE UPDATE ON classroom_courses
FOR EACH ROW
EXECUTE FUNCTION update_classroom_courses_updated_at();

-- Enable RLS
ALTER TABLE classroom_courses ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view courses in their chamas
CREATE POLICY view_chama_courses ON classroom_courses
FOR SELECT
USING (
  chama_id IN (
    SELECT chama_id FROM chama_members 
    WHERE user_id = current_setting('app.user_id')::UUID 
    AND status = 'active'
  )
  AND deleted_at IS NULL
);

-- RLS: Only admins can insert courses
CREATE POLICY insert_chama_courses ON classroom_courses
FOR INSERT
WITH CHECK (
  chama_id IN (
    SELECT chama_id FROM chama_members 
    WHERE user_id = current_setting('app.user_id')::UUID 
    AND status = 'active'
    AND role IN ('admin', 'secretary', 'treasurer')
  )
);

-- RLS: Only admins can update courses
CREATE POLICY update_chama_courses ON classroom_courses
FOR UPDATE
USING (
  chama_id IN (
    SELECT chama_id FROM chama_members 
    WHERE user_id = current_setting('app.user_id')::UUID 
    AND status = 'active'
    AND role IN ('admin', 'secretary', 'treasurer')
  )
);

-- RLS: Only admins can delete courses (soft delete)
CREATE POLICY delete_chama_courses ON classroom_courses
FOR UPDATE
USING (
  chama_id IN (
    SELECT chama_id FROM chama_members 
    WHERE user_id = current_setting('app.user_id')::UUID 
    AND status = 'active'
    AND role IN ('admin', 'secretary', 'treasurer')
  )
)
WITH CHECK (
  deleted_at IS NOT NULL
);

