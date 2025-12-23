/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  FileText,
  Download,
  Share2,
  Trash2,
  Eye,
  Lock,
  Calendar,
  User,
  Search,
  Filter,
  FolderOpen,
  Tag,
  Clock,
  Shield,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const DOCUMENT_TYPES = [
  "CONSTITUTION",
  "MEETING_MINUTES",
  "TRANSACTION_STATEMENTS",
  "LOAN_AGREEMENTS",
  "INVESTMENT_CERTIFICATES",
  "MEMBER_CONTRACTS",
  "AUDIT_REPORTS",
  "OTHER",
];

export function DocumentVault({ chamaId }: { chamaId: string }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [folders, setFolders] = useState<string[]>([]);

  // Upload modal state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: "",
    description: "",
    documentType: "",
    folderPath: "",
    tags: [] as string[],
    file: null as File | null,
  });

  // Preview modal state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  // Version history state
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  // Access control state
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, [chamaId, searchQuery, selectedType, selectedFolder]);

  // Fetch documents with filters
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedType) params.append("type", selectedType);
      if (selectedFolder) params.append("folder", selectedFolder);

      const response = await fetch(
        `${API_URL}/documents/${chamaId}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch documents");

      const data = await response.json();
      setDocuments(data);

      // Extract unique folders
      const uniqueFolders = new Set(
        data
          .filter((doc: any) => doc.folder_path)
          .map((doc: any) => doc.folder_path.split("/")[0])
      );
      setFolders(Array.from(uniqueFolders) as string[]);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.add("bg-blue-50");
  };

  const handleDragLeave = () => {
    dropZoneRef.current?.classList.remove("bg-blue-50");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove("bg-blue-50");

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setUploadData({ ...uploadData, file: files[0] as File });
      setShowUploadDialog(true);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadData.file || !uploadData.name || !uploadData.documentType) {
      alert("Please fill in all required fields and select a file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadData.file);
      formData.append("name", uploadData.name);
      formData.append("description", uploadData.description);
      formData.append("documentType", uploadData.documentType);
      formData.append("folderPath", uploadData.folderPath);
      formData.append("tags", JSON.stringify(uploadData.tags));

      const response = await fetch(`${API_URL}/documents/${chamaId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      // Reset form and refresh
      setUploadData({
        name: "",
        description: "",
        documentType: "",
        folderPath: "",
        tags: [],
        file: null,
      });
      setShowUploadDialog(false);
      fetchDocuments();
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  // View document preview
  const handlePreview = (doc: any) => {
    setSelectedDocument(doc);
    setShowPreviewDialog(true);
  };

  // View version history
  const handleViewVersions = async (doc: any) => {
    try {
      const response = await fetch(
        `${API_URL}/documents/${chamaId}/${doc.id}/versions`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch versions");

      const data = await response.json();
      setVersions(data);
      setSelectedDocument(doc);
      setShowVersionsDialog(true);
    } catch (error) {
      console.error("Error fetching versions:", error);
    }
  };

  // View access logs
  const handleViewAccessLogs = async (doc: any) => {
    try {
      const response = await fetch(
        `${API_URL}/documents/${chamaId}/${doc.id}/logs`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch logs");

      const data = await response.json();
      setAccessLogs(data);
      setSelectedDocument(doc);
      setShowAccessDialog(true);
    } catch (error) {
      console.error("Error fetching access logs:", error);
    }
  };

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(`${API_URL}/documents/${chamaId}/${docId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!response.ok) throw new Error("Delete failed");

      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#083232]">Document Vault</h1>
          <p className="text-sm text-gray-600 mt-1">
            Secure storage for chama documents
          </p>
        </div>
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button className="bg-[#083232] hover:bg-[#2e856e] text-white">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Drag and drop zone */}
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#083232] transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-medium">
                  Drag files here or click to browse
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {uploadData.file?.name || "No file selected"}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setUploadData({
                      ...uploadData,
                      file: e.target.files[0],
                    });
                  }
                }}
              />

              {/* Form fields */}
              <div>
                <Label>Document Name *</Label>
                <Input
                  placeholder="e.g., Constitution 2025"
                  value={uploadData.name}
                  onChange={(e) =>
                    setUploadData({ ...uploadData, name: e.target.value })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Document Type *</Label>
                <Select
                  value={uploadData.documentType}
                  onValueChange={(value) =>
                    setUploadData({ ...uploadData, documentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Add a brief description..."
                  value={uploadData.description}
                  onChange={(e) =>
                    setUploadData({
                      ...uploadData,
                      description: e.target.value,
                    })
                  }
                  className="mt-1 resize-none h-20"
                />
              </div>

              <div>
                <Label>Folder Path</Label>
                <Input
                  placeholder="e.g., Meeting Minutes/2025/January"
                  value={uploadData.folderPath}
                  onChange={(e) =>
                    setUploadData({
                      ...uploadData,
                      folderPath: e.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-[#083232] hover:bg-[#2e856e] text-white"
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger>
              <FolderOpen className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Folders" />
            </SelectTrigger>
            <SelectContent>
              {folders.map((folder) => (
                <SelectItem key={folder} value={folder}>
                  {folder}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedType || selectedFolder) && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedType("");
                setSelectedFolder("");
                setSearchQuery("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">No documents yet</p>
          <p className="text-sm text-gray-400">
            Upload documents to get started
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc: any) => (
            <Card
              key={doc.id}
              className="p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#083232]" />
                    <div>
                      <h3 className="font-semibold text-[#083232]">
                        {doc.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {doc.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {doc.document_type.replace(/_/g, " ")}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {doc.creator_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />v{doc.current_version}
                        </span>
                      </div>
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {doc.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreview(doc)}
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewVersions(doc)}
                    title="Version History"
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewAccessLogs(doc)}
                    title="Access Logs"
                  >
                    <Shield className="w-4 h-4" />
                  </Button>
                  <a
                    href={doc.file_url}
                    download
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4 text-gray-600" />
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      {selectedDocument && (
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedDocument.name}</DialogTitle>
            </DialogHeader>
            <div className="bg-gray-100 rounded-lg p-6 text-center min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 font-medium">
                  {selectedDocument.mime_type}
                </p>
                <a
                  href={selectedDocument.file_url}
                  download
                  className="text-[#083232] hover:underline mt-4 inline-block"
                >
                  Download to view
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Version History Dialog */}
      {selectedDocument && (
        <Dialog open={showVersionsDialog} onOpenChange={setShowVersionsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Version History - {selectedDocument.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {versions.map((version: any) => (
                <Card key={version.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">v{version.version_number}</p>
                      <p className="text-xs text-gray-600">
                        Uploaded by {version.uploaded_by_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(version.created_at).toLocaleString()}
                      </p>
                      {version.change_description && (
                        <p className="text-xs text-gray-600 mt-1 italic">
                          {version.change_description}
                        </p>
                      )}
                    </div>
                    <a
                      href={version.file_url}
                      download
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <Download className="w-4 h-4 text-gray-600" />
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Access Logs Dialog */}
      {selectedDocument && (
        <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Access Logs - {selectedDocument.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto text-sm">
              {accessLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No access logs</p>
              ) : (
                accessLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-2 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{log.user_name}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.success
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {log.action}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
