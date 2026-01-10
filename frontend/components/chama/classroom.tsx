"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Music,
  Video,
  Download,
  Trash2,
  Play,
  Loader2,
  X,
  Lock,
} from "lucide-react";
import { apiUrl, API_BASE_URL } from "@/lib/api-config";
import { CourseDetail } from "./course-detail";

// Helper function to construct thumbnail URL
const getThumbnailUrl = (
  thumbnailUrl: string | null | undefined
): string | undefined => {
  if (!thumbnailUrl) {
    console.log("[Classroom] No thumbnail URL provided");
    return undefined;
  }

  console.log("[Classroom] Processing thumbnail URL:", {
    original: thumbnailUrl,
    apiBaseUrl: API_BASE_URL,
  });

  // If it's already a full URL (http:// or https://), check if port needs to be corrected
  if (
    thumbnailUrl.startsWith("http://") ||
    thumbnailUrl.startsWith("https://")
  ) {
    // If the URL has localhost:4000 but our API is on different port, replace it
    if (thumbnailUrl.includes("localhost:4000")) {
      const correctedUrl = thumbnailUrl.replace(
        "localhost:4000",
        API_BASE_URL.replace(/^https?:\/\//, "")
      );
      console.log(
        "[Classroom] Corrected thumbnail URL (port fix):",
        correctedUrl
      );
      return correctedUrl;
    }
    console.log("[Classroom] Using thumbnail URL as-is:", thumbnailUrl);
    return thumbnailUrl;
  }

  // If it starts with /uploads, construct the full URL using API base
  if (thumbnailUrl.startsWith("/uploads")) {
    const fullUrl = `${API_BASE_URL}${thumbnailUrl}`;
    console.log(
      "[Classroom] Constructed thumbnail URL from /uploads:",
      fullUrl
    );
    return fullUrl;
  }

  // Otherwise, assume it's a relative path and prepend /uploads
  const fullUrl = `${API_BASE_URL}/uploads/${thumbnailUrl}`;
  console.log(
    "[Classroom] Constructed thumbnail URL from relative path:",
    fullUrl
  );
  return fullUrl;
};

interface Course {
  id: string;
  title: string;
  description?: string;
  fileType: "pdf" | "audio" | "video";
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  progress?: number; // 0-100, tracking user's learning progress
  thumbnailUrl?: string; // Optional thumbnail image URL
  isLocked?: boolean;
  lockReason?: string;
  lockType?: "none" | "reputation" | "price" | "both";
  requiredReputationTier?:
    | "bronze"
    | "silver"
    | "gold"
    | "platinum"
    | "diamond";
  unlockPrice?: number;
}

export function Classroom({
  chamaId,
  isMember,
  isAdmin,
}: {
  chamaId: string;
  isMember: boolean;
  isAdmin?: boolean;
}) {
  console.log("[Classroom] Component rendered", { chamaId, isMember, isAdmin });

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [uploadData, setUploadData] = useState({
    title: "",
    description: "",
    fileType: "pdf" as "pdf" | "audio" | "video",
    file: null as File | null,
    thumbnail: null as File | null,
    lockType: "none" as "none" | "reputation" | "price" | "both",
    requiredReputationTier: "" as
      | ""
      | "bronze"
      | "silver"
      | "gold"
      | "platinum"
      | "diamond",
    unlockPrice: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch(
        apiUrl(`chama/${chamaId}/classroom/courses`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(
          "[Classroom] Courses fetched:",
          data.courses?.map((c: Course) => ({
            id: c.id,
            title: c.title,
            thumbnailUrl: c.thumbnailUrl,
          }))
        );
        // Add mock progress for now (will be replaced with actual tracking later)
        const coursesWithProgress = (data.courses || []).map(
          (course: Course) => ({
            ...course,
            progress: course.progress ?? 0, // Start at 0% until user begins learning
          })
        );
        setCourses(coursesWithProgress);
      }
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    // Get current user ID from token
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken) {
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        setUserId(payload.sub || payload.userId || "");
      }
    } catch (error) {
      console.error("Failed to parse token:", error);
    }

    fetchCourses();
  }, [fetchCourses]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[Classroom] File selected", event.target.files);
    const file = event.target.files?.[0];
    if (!file) {
      console.log("[Classroom] No file selected");
      return;
    }

    console.log("[Classroom] File details:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Determine file type based on MIME type and file extension
    let fileType: "pdf" | "audio" | "video" = "pdf";
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf(".") + 1);

    // Video extensions
    const videoExtensions = [
      "mp4",
      "mkv",
      "avi",
      "mov",
      "wmv",
      "flv",
      "webm",
      "m4v",
      "3gp",
      "mpg",
      "mpeg",
      "m2v",
      "f4v",
      "asf",
      "rm",
      "rmvb",
      "vob",
      "ogv",
      "ts",
      "mts",
      "m2ts",
    ];
    // Audio extensions
    const audioExtensions = [
      "mp3",
      "wav",
      "aac",
      "ogg",
      "flac",
      "wma",
      "m4a",
      "opus",
      "amr",
      "3gp",
      "au",
      "ra",
      "aiff",
      "aif",
      "caf",
      "ape",
      "dsd",
      "dsf",
      "dff",
    ];
    // PDF extension
    const pdfExtensions = ["pdf"];

    // Check MIME type first
    if (file.type.startsWith("audio/")) {
      fileType = "audio";
    } else if (file.type.startsWith("video/")) {
      fileType = "video";
    } else if (
      file.type === "application/pdf" ||
      file.type === "application/x-pdf"
    ) {
      fileType = "pdf";
    }
    // Fallback to file extension if MIME type is not recognized
    else if (videoExtensions.includes(fileExtension)) {
      fileType = "video";
    } else if (audioExtensions.includes(fileExtension)) {
      fileType = "audio";
    } else if (pdfExtensions.includes(fileExtension)) {
      fileType = "pdf";
    } else {
      console.warn("[Classroom] Invalid file type:", {
        mimeType: file.type,
        extension: fileExtension,
        fileName: file.name,
      });
      alert(
        "Please select a PDF, audio, or video file. Supported formats: PDF, MP4, MKV, AVI, MOV, MP3, WAV, AAC, and more."
      );
      return;
    }

    // Validate file size (350MB max)
    const maxSize = 350 * 1024 * 1024; // 350MB
    if (file.size > maxSize) {
      console.warn("[Classroom] File too large:", file.size);
      alert("File size must be less than 350MB");
      return;
    }

    console.log("[Classroom] Setting file data", {
      fileType,
      fileName: file.name,
    });
    setUploadData((prev) => ({
      ...prev,
      file,
      fileType,
    }));
  };

  const handleUpload = async () => {
    console.log("[Classroom] ===== handleUpload CALLED =====", {
      file: uploadData.file?.name,
      thumbnail: uploadData.thumbnail?.name,
      title: uploadData.title,
      fileType: uploadData.fileType,
      hasFile: !!uploadData.file,
      hasTitle: !!uploadData.title,
      hasThumbnail: !!uploadData.thumbnail,
    });

    if (!uploadData.file || !uploadData.title) {
      console.warn("[Classroom] Validation failed - missing file or title");
      alert("Please fill in the title and select a file");
      return;
    }

    console.log("[Classroom] Starting upload...", {
      title: uploadData.title,
      fileType: uploadData.fileType,
      fileName: uploadData.file.name,
      fileSize: uploadData.file.size,
    });

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadData.file);
      if (uploadData.thumbnail) {
        formData.append("thumbnail", uploadData.thumbnail);
      }
      formData.append("title", uploadData.title);
      formData.append("description", uploadData.description || "");
      formData.append("fileType", uploadData.fileType);
      formData.append("lockType", uploadData.lockType);
      if (
        uploadData.lockType === "reputation" ||
        uploadData.lockType === "both"
      ) {
        formData.append(
          "requiredReputationTier",
          uploadData.requiredReputationTier
        );
      }
      if (uploadData.lockType === "price" || uploadData.lockType === "both") {
        formData.append("unlockPrice", uploadData.unlockPrice);
      }

      const token = localStorage.getItem("accessToken");
      if (!token) {
        alert("Please log in to upload courses");
        setUploading(false);
        return;
      }

      const url = apiUrl(`chama/${chamaId}/classroom/courses`);
      console.log("Uploading course to:", url);
      console.log("FormData entries:", {
        hasFile: formData.has("file"),
        title: formData.get("title"),
        description: formData.get("description"),
        fileType: formData.get("fileType"),
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - let browser set it with boundary for FormData
        },
        body: formData,
      });

      console.log("Upload response:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Upload failed";
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.message || error.error || errorMessage;
          console.error("Upload error (parsed):", error);
        } catch {
          errorMessage = errorText || errorMessage;
          console.error("Upload error (text):", errorText);
        }
        console.error("Upload error details:", {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          url,
        });
        alert(`Upload failed: ${errorMessage}`);
        setUploading(false);
        return;
      }

      const result = await response.json();
      console.log("Upload successful:", result);

      // Reset form and refresh
      setUploadData({
        title: "",
        description: "",
        fileType: "pdf",
        file: null,
        thumbnail: null,
        lockType: "none",
        requiredReputationTier: "",
        unlockPrice: "",
      });
      setShowUploadDialog(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (thumbnailInputRef.current) {
        thumbnailInputRef.current.value = "";
      }
      await fetchCourses();
      alert("Course uploaded successfully!");
    } catch (error) {
      console.error("Error uploading course:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to upload course. Please check the console for details.";
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleUnlock = async (course: Course) => {
    if (!course.isLocked) return;

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        alert("Please log in to unlock courses");
        return;
      }

      // Determine unlock method
      let unlockMethod: "reputation" | "purchase" = "reputation";
      if (course.lockType === "price") {
        unlockMethod = "purchase";
      } else if (course.lockType === "both") {
        // If both, prefer reputation if user has it, otherwise purchase
        // For now, let's check reputation first
        unlockMethod = "reputation";
      }

      // If it's a purchase, confirm first
      if (unlockMethod === "purchase" && course.unlockPrice) {
        const confirmed = confirm(
          `Unlock this course for Kes ${course.unlockPrice}?`
        );
        if (!confirmed) return;
      }

      const url = apiUrl(
        `chama/${chamaId}/classroom/courses/${course.id}/unlock`
      );
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ unlockMethod }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || "Failed to unlock course");
        return;
      }

      const result = await response.json();
      alert(result.message || "Course unlocked successfully!");
      await fetchCourses(); // Refresh courses
    } catch (error) {
      console.error("Error unlocking course:", error);
      alert("Failed to unlock course. Please try again.");
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!confirm("Are you sure you want to delete this course?")) return;

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch(
        apiUrl(`chama/${chamaId}/classroom/courses/${courseId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete course");
      }

      fetchCourses();
    } catch (error) {
      console.error("Error deleting course:", error);
      alert("Failed to delete course");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (fileType: string, size: "sm" | "lg" = "sm") => {
    const iconSize = size === "lg" ? "w-12 h-12" : "w-5 h-5";
    switch (fileType) {
      case "pdf":
        return <FileText className={`${iconSize} text-white`} />;
      case "audio":
        return <Music className={`${iconSize} text-white`} />;
      case "video":
        return <Video className={`${iconSize} text-white`} />;
      default:
        return <FileText className={`${iconSize} text-white`} />;
    }
  };

  const getThumbnailBg = (fileType: string) => {
    switch (fileType) {
      case "pdf":
        return "bg-gradient-to-br from-red-500 to-red-600";
      case "audio":
        return "bg-gradient-to-br from-blue-500 to-blue-600";
      case "video":
        return "bg-gradient-to-br from-purple-500 to-purple-600";
      default:
        return "bg-gradient-to-br from-gray-500 to-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#083232]" />
      </div>
    );
  }

  // If a course is selected, show the detail view instead of the grid
  if (selectedCourse) {
    return (
      <CourseDetail
        course={selectedCourse}
        onClose={() => {
          setSelectedCourse(null);
          // Refresh courses to update progress
          fetchCourses();
        }}
        chamaId={chamaId}
        userId={userId}
      />
    );
  }

  return (
    <div className="space-y-2 md:space-y-4 pb-14 md:pb-0">
      {/* Header */}
      <div className="bg-gray-50 md:bg-white border-b border-gray-200 md:border md:rounded-lg md:shadow-sm px-4 py-5 md:p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
          <p className="text-sm md:text-base text-gray-700 flex-1 text-center md:text-left leading-relaxed max-w-2xl">
            Discover lessons, resources, & training materials or share your
            knowledge by uploading materials
          </p>
          {isMember && (
            <>
              <button
                onClick={() => {
                  console.log("[Classroom] Upload Course button clicked");
                  setShowUploadDialog(true);
                }}
                className="w-full md:w-auto px-5 py-2.5 text-[#083232] font-semibold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap border border-[#083232] rounded-md hover:bg-[#083232] hover:text-white cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Upload Course
              </button>
              <Dialog
                open={showUploadDialog}
                onOpenChange={(open) => {
                  console.log("[Classroom] Dialog open changed:", open);
                  setShowUploadDialog(open);
                  // Reset form when dialog closes
                  if (!open) {
                    setUploadData({
                      title: "",
                      description: "",
                      fileType: "pdf",
                      file: null,
                      thumbnail: null,
                      lockType: "none",
                      requiredReputationTier: "",
                      unlockPrice: "",
                    });
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                    if (thumbnailInputRef.current) {
                      thumbnailInputRef.current.value = "";
                    }
                  }
                }}
              >
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Upload Course</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Course Title *</Label>
                      <Input
                        id="title"
                        value={uploadData.title}
                        onChange={(e) =>
                          setUploadData({
                            ...uploadData,
                            title: e.target.value,
                          })
                        }
                        placeholder="Enter course title"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={uploadData.description}
                        onChange={(e) =>
                          setUploadData({
                            ...uploadData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Enter course description (optional)"
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="file">
                        File (PDF, Audio, or Video) *
                      </Label>
                      <div className="mt-1">
                        <Input
                          ref={fileInputRef}
                          id="file"
                          type="file"
                          accept=".pdf,.mp4,.mkv,.avi,.mov,.wmv,.flv,.webm,.m4v,.3gp,.mpg,.mpeg,.mp3,.wav,.aac,.ogg,.flac,.wma,.m4a,.opus,.amr,.au,.ra,.aiff,.aif,.caf,.ape,.dsd,.dsf,.dff,.m2v,.f4v,.asf,.rm,.rmvb,.vob,.ogv,.ts,.mts,.m2ts,audio/*,video/*"
                          onChange={handleFileSelect}
                          className="cursor-pointer"
                        />
                        {uploadData.file && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                            {getFileIcon(uploadData.fileType)}
                            <span className="flex-1 truncate">
                              {uploadData.file.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatFileSize(uploadData.file.size)}
                            </span>
                            <button
                              onClick={() =>
                                setUploadData({ ...uploadData, file: null })
                              }
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Maximum file size: 350MB. Supported formats: PDF, MP4,
                        MKV, AVI, MOV, WMV, FLV, WebM, MP3, WAV, AAC, OGG, FLAC,
                        WMA, and more.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="thumbnail">
                        Thumbnail Image (Optional)
                      </Label>
                      <div className="mt-1">
                        <Input
                          ref={thumbnailInputRef}
                          id="thumbnail"
                          type="file"
                          accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.ico,.tiff,.tif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Validate it's an image (check MIME type and extension)
                              const fileName = file.name.toLowerCase();
                              const fileExtension = fileName.substring(
                                fileName.lastIndexOf(".") + 1
                              );
                              const imageExtensions = [
                                "jpg",
                                "jpeg",
                                "png",
                                "gif",
                                "webp",
                                "bmp",
                                "svg",
                                "ico",
                                "tiff",
                                "tif",
                              ];
                              const isImageMimeType =
                                file.type.startsWith("image/");
                              const isImageExtension =
                                imageExtensions.includes(fileExtension);

                              if (!isImageMimeType && !isImageExtension) {
                                alert(
                                  "Please select an image file (JPEG, PNG, GIF, WebP, BMP, SVG, ICO, or TIFF)"
                                );
                                return;
                              }
                              // Validate size (5MB max)
                              const maxSize = 5 * 1024 * 1024; // 5MB
                              if (file.size > maxSize) {
                                alert("Thumbnail size must be less than 5MB");
                                return;
                              }
                              setUploadData({ ...uploadData, thumbnail: file });
                            }
                          }}
                          className="cursor-pointer"
                        />
                        {uploadData.thumbnail && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                            <img
                              src={URL.createObjectURL(uploadData.thumbnail)}
                              alt="Thumbnail preview"
                              className="w-16 h-16 object-cover rounded border border-gray-200"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs font-medium">
                                {uploadData.thumbnail.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(uploadData.thumbnail.size)}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setUploadData({
                                  ...uploadData,
                                  thumbnail: null,
                                });
                                if (thumbnailInputRef.current) {
                                  thumbnailInputRef.current.value = "";
                                }
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Optional: Upload a thumbnail image for the course card.
                        Maximum size: 5MB. Supported formats: JPEG, PNG, GIF,
                        WebP, BMP, SVG, ICO, TIFF.
                      </p>
                    </div>

                    {/* Course Locking Options */}
                    <div className="border-t border-gray-200 pt-4 space-y-4">
                      <div>
                        <Label htmlFor="lockType">Course Access</Label>
                        <Select
                          value={uploadData.lockType}
                          onValueChange={(
                            value: "none" | "reputation" | "price" | "both"
                          ) =>
                            setUploadData({ ...uploadData, lockType: value })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select access type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Free (No Lock)</SelectItem>
                            <SelectItem value="reputation">
                              Lock by Reputation Tier
                            </SelectItem>
                            <SelectItem value="price">Lock by Price</SelectItem>
                            <SelectItem value="both">
                              Lock by Both (Reputation or Price)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(uploadData.lockType === "reputation" ||
                        uploadData.lockType === "both") && (
                        <div>
                          <Label htmlFor="requiredReputationTier">
                            Required Reputation Tier *
                          </Label>
                          <Select
                            value={uploadData.requiredReputationTier}
                            onValueChange={(
                              value:
                                | "bronze"
                                | "silver"
                                | "gold"
                                | "platinum"
                                | "diamond"
                            ) =>
                              setUploadData({
                                ...uploadData,
                                requiredReputationTier: value,
                              })
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select tier" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bronze">Bronze</SelectItem>
                              <SelectItem value="silver">Silver</SelectItem>
                              <SelectItem value="gold">Gold</SelectItem>
                              <SelectItem value="platinum">Platinum</SelectItem>
                              <SelectItem value="diamond">Diamond</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {(uploadData.lockType === "price" ||
                        uploadData.lockType === "both") && (
                        <div>
                          <Label htmlFor="unlockPrice">
                            Unlock Price (KES) *
                          </Label>
                          <Input
                            id="unlockPrice"
                            type="number"
                            min="5"
                            step="1"
                            value={uploadData.unlockPrice}
                            onChange={(e) =>
                              setUploadData({
                                ...uploadData,
                                unlockPrice: e.target.value,
                              })
                            }
                            placeholder="Minimum: Kes 5"
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Minimum price is Kes 5
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowUploadDialog(false)}
                        disabled={uploading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("[Classroom] Upload button clicked", {
                            uploading,
                            hasFile: !!uploadData.file,
                            hasTitle: !!uploadData.title,
                            disabled:
                              uploading ||
                              !uploadData.file ||
                              !uploadData.title,
                          });
                          if (
                            !uploading &&
                            uploadData.file &&
                            uploadData.title
                          ) {
                            handleUpload();
                          } else {
                            console.warn(
                              "[Classroom] Upload button disabled or missing data"
                            );
                          }
                        }}
                        disabled={
                          uploading || !uploadData.file || !uploadData.title
                        }
                        className="bg-[#083232] hover:bg-[#2e856e]"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <div className="p-6 md:p-8 text-center bg-white border rounded-lg shadow-sm">
          <FileText className="w-8 h-8 md:w-10 md:h-10 text-gray-400 mx-auto mb-2 md:mb-3" />
          <p className="text-xs md:text-sm text-gray-600">
            No courses available yet.
            {isMember && " Upload your first course to get started!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => {
                if (!course.isLocked) {
                  setSelectedCourse(course);
                }
              }}
              className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${
                course.isLocked
                  ? "cursor-not-allowed opacity-75"
                  : "cursor-pointer"
              }`}
            >
              {/* Thumbnail/Header */}
              <div
                className={`${getThumbnailBg(
                  course.fileType
                )} h-32 flex items-center justify-center relative overflow-hidden`}
              >
                {course.thumbnailUrl ? (
                  <img
                    src={getThumbnailUrl(course.thumbnailUrl)}
                    alt={course.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error("[Classroom] Failed to load thumbnail:", {
                        originalUrl: course.thumbnailUrl,
                        constructedUrl: getThumbnailUrl(course.thumbnailUrl),
                        courseId: course.id,
                        courseTitle: course.title,
                        error: e,
                      });
                      // Hide the broken image and show the default icon
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent && !parent.querySelector(".fallback-icon")) {
                        const fallback = document.createElement("div");
                        fallback.className =
                          "fallback-icon flex items-center justify-center absolute inset-0";
                        fallback.innerHTML =
                          parent.querySelector("svg")?.outerHTML || "";
                        parent.appendChild(fallback);
                      }
                    }}
                    onLoad={() => {
                      console.log(
                        "[Classroom] Thumbnail loaded successfully:",
                        {
                          originalUrl: course.thumbnailUrl,
                          constructedUrl: getThumbnailUrl(course.thumbnailUrl),
                          courseId: course.id,
                        }
                      );
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center">
                    {getFileIcon(course.fileType, "lg")}
                  </div>
                )}
                {course.isLocked && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="text-center text-white px-4">
                      <Lock className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2" />
                      <p className="text-xs md:text-sm font-semibold">
                        {course.lockReason}
                      </p>
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering course selection
                      handleDelete(course.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/20 hover:bg-black/40 rounded transition-colors z-10"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="p-4 flex-1 flex flex-col">
                <h4 className="font-bold text-base text-gray-900 mb-2 line-clamp-2">
                  {course.title}
                </h4>
                {course.description && (
                  <p className="text-xs text-gray-600 mb-4 line-clamp-2 flex-1">
                    {course.description}
                  </p>
                )}

                {/* Progress Bar */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Progress</span>
                    <span className="text-xs font-semibold text-gray-700">
                      {course.progress ?? 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-[#083232] transition-all duration-300 rounded-full"
                      style={{ width: `${course.progress ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="capitalize">{course.fileType}</span>
                    <span>•</span>
                    <span>{formatFileSize(course.fileSize)}</span>
                  </div>
                  {!course.isLocked && (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a
                        href={course.fileUrl}
                        download
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-[#083232]" />
                      </a>
                      {course.fileType === "video" ||
                      course.fileType === "audio" ? (
                        <a
                          href={course.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="Play"
                        >
                          <Play className="w-4 h-4 text-[#083232]" />
                        </a>
                      ) : (
                        <a
                          href={course.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="View"
                        >
                          <FileText className="w-4 h-4 text-[#083232]" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
                {course.isLocked && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await handleUnlock(course);
                    }}
                    className="w-full text-xs md:text-sm py-2 px-3 bg-[#083232] text-white rounded hover:bg-[#2e856e] transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3 h-3 md:w-4 md:h-4" />
                    {course.lockReason}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
