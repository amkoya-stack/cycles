-- Create document vault system
-- Phase 9: Secure document storage with versioning and access control

-- Document types enum
CREATE TYPE document_type AS ENUM (
  'CONSTITUTION',
  'MEETING_MINUTES',
  'TRANSACTION_STATEMENTS',
  'LOAN_AGREEMENTS',
  'INVESTMENT_CERTIFICATES',
  'MEMBER_CONTRACTS',
  'AUDIT_REPORTS',
  'OTHER'
);

-- Main documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  
  -- Document metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  document_type document_type NOT NULL,
  folder_path VARCHAR(500), -- e.g., "Meeting Minutes/2025/January"
  tags TEXT[] DEFAULT '{}',
  
  -- File info
  file_url TEXT NOT NULL, -- Cloudflare R2 / S3 URL
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_hash VARCHAR(255), -- SHA256 for integrity checking
  
  -- Encryption
  is_encrypted BOOLEAN DEFAULT TRUE,
  encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
  
  -- Tracking
  current_version INT DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_document_per_chama UNIQUE (chama_id, name, deleted_at)
);

-- Document versions for history tracking
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  version_number INT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_hash VARCHAR(255),
  
  uploaded_by UUID NOT NULL REFERENCES users(id),
  change_description TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_version_per_document UNIQUE (document_id, version_number)
);

-- Document access control (role-based permissions)
CREATE TABLE document_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- User or role access
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50), -- CHAIRPERSON, VICE_CHAIR, SECRETARY, TREASURER, MEMBER, GUEST
  
  -- Permissions
  can_view BOOLEAN DEFAULT TRUE,
  can_download BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_share BOOLEAN DEFAULT FALSE,
  
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Optional: temporary access
  
  CONSTRAINT access_requires_user_or_role CHECK (user_id IS NOT NULL OR role IS NOT NULL)
);

-- Access audit log (for security)
CREATE TABLE document_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  action VARCHAR(50) NOT NULL, -- VIEW, DOWNLOAD, UPLOAD, DELETE, SHARE, PERMISSION_CHANGE
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document search index (for full-text search)
CREATE TABLE document_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Searchable content
  name_tsvector TSVECTOR,
  description_tsvector TSVECTOR,
  tags_tsvector TSVECTOR,
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_search_index UNIQUE (document_id)
);

-- Create indexes for performance
CREATE INDEX idx_documents_chama_id ON documents(chama_id, deleted_at DESC);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_folder ON documents(folder_path);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX idx_document_access_document_id ON document_access(document_id);
CREATE INDEX idx_document_access_user_id ON document_access(user_id);
CREATE INDEX idx_document_access_logs_document_id ON document_access_logs(document_id);
CREATE INDEX idx_document_access_logs_user_id ON document_access_logs(user_id);
CREATE INDEX idx_document_access_logs_created_at ON document_access_logs(created_at DESC);

-- Create full-text search index
CREATE INDEX idx_document_search_name ON document_search_index USING GIN(name_tsvector);
CREATE INDEX idx_document_search_description ON document_search_index USING GIN(description_tsvector);
CREATE INDEX idx_document_search_tags ON document_search_index USING GIN(tags_tsvector);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_timestamp
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_documents_updated_at();

-- Trigger to update search index
CREATE OR REPLACE FUNCTION update_document_search_index()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_search_index (document_id, name_tsvector, description_tsvector, tags_tsvector)
  VALUES (
    NEW.id,
    to_tsvector('english', COALESCE(NEW.name, '')),
    to_tsvector('english', COALESCE(NEW.description, '')),
    to_tsvector('english', array_to_string(NEW.tags, ' '))
  )
  ON CONFLICT (document_id) DO UPDATE SET
    name_tsvector = to_tsvector('english', COALESCE(NEW.name, '')),
    description_tsvector = to_tsvector('english', COALESCE(NEW.description, '')),
    tags_tsvector = to_tsvector('english', array_to_string(NEW.tags, ' ')),
    updated_at = CURRENT_TIMESTAMP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_search
AFTER INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_document_search_index();

-- Grant RLS policies for document access
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see documents their chama has access to
CREATE POLICY view_chama_documents ON documents
FOR SELECT
USING (
  chama_id IN (
    SELECT id FROM chamas 
    WHERE id IN (
      SELECT chama_id FROM chama_members WHERE user_id = current_setting('app.user_id')::UUID
    )
  )
  OR created_by = current_setting('app.user_id')::UUID
);

-- RLS: Document access logs visible only to document creator and chama admins
CREATE POLICY view_access_logs ON document_access_logs
FOR SELECT
USING (
  document_id IN (
    SELECT id FROM documents WHERE created_by = current_setting('app.user_id')::UUID
  )
  OR user_id = current_setting('app.user_id')::UUID
);
