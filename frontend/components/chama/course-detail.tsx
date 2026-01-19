"use client";

import { useState, useEffect, useRef } from "react";
import { X, Play, Pause, Volume2, VolumeX, CheckCircle } from "lucide-react";
import { apiUrl, API_BASE_URL } from "@/lib/api-config";

interface Course {
  id: string;
  title: string;
  description?: string;
  fileType: "pdf" | "audio" | "video";
  fileName: string;
  fileUrl: string;
  fileSize: number;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  progress?: number;
}

interface Lesson {
  id: string;
  title: string;
  content?: string;
  order: number;
  completed?: boolean;
}

interface CourseDetailProps {
  course: Course;
  onClose: () => void;
  chamaId: string;
  userId: string;
}

export function CourseDetail({
  course,
  onClose,
  chamaId,
  userId,
}: CourseDetailProps) {
  const [activeLesson, setActiveLesson] = useState<number>(0);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState(course.progress || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Parse lessons from course description
  // Later, this will come from the backend as structured lessons
  useEffect(() => {
    if (course.description) {
      const lines = course.description.split("\n").filter((l) => l.trim());
      const parsedLessons: Lesson[] = [];
      let currentLesson: Lesson | null = null;
      let lessonContent: string[] = [];

      lines.forEach((line, index) => {
        // Check if line looks like a lesson title (starts with number, #, **, or uppercase heading)
        const isLessonTitle = line.match(
          /^\d+\.|^#{1,3}\s+|^\*\*|^[A-Z][A-Z\s]+:$/
        );

        if (isLessonTitle) {
          // Save previous lesson if exists
          if (currentLesson) {
            currentLesson.content = lessonContent.join("\n").trim();
            parsedLessons.push(currentLesson);
          }

          // Create new lesson
          const title = line.replace(/^\d+\.\s*|^#+\s*|\*\*|:$/g, "").trim();
          currentLesson = {
            id: `lesson-${parsedLessons.length}`,
            title: title || `Lesson ${parsedLessons.length + 1}`,
            content: "",
            order: parsedLessons.length,
            completed: false,
          };
          lessonContent = [];
        } else if (currentLesson) {
          // Add to current lesson content
          lessonContent.push(line);
        } else {
          // First line that's not a title - create first lesson
          currentLesson = {
            id: "lesson-0",
            title: "Course Content",
            content: "",
            order: 0,
            completed: false,
          };
          lessonContent.push(line);
        }
      });

      // Save last lesson
      if (currentLesson) {
        const lesson = currentLesson as Lesson;
        lesson.content = lessonContent.join("\n").trim() || course.description;
        parsedLessons.push(lesson);
      }

      if (parsedLessons.length > 0) {
        setLessons(parsedLessons);
      } else {
        // Fallback: single lesson
        setLessons([
          {
            id: "lesson-0",
            title: "Course Content",
            content: course.description,
            order: 0,
            completed: false,
          },
        ]);
      }
    } else {
      // Default: single lesson
      setLessons([
        {
          id: "lesson-0",
          title: "Course Content",
          content: "No content available yet.",
          order: 0,
          completed: false,
        },
      ]);
    }
  }, [course.description]);

  // Update progress when lesson is completed
  const markLessonComplete = async (lessonId: string) => {
    const lessonIndex = lessons.findIndex((l) => l.id === lessonId);
    if (lessonIndex === -1) return;

    const updatedLessons = lessons.map((lesson, index) => {
      if (lesson.id === lessonId) {
        return { ...lesson, completed: true };
      }
      return lesson;
    });
    setLessons(updatedLessons);

    // Calculate progress
    const completedCount = updatedLessons.filter((l) => l.completed).length;
    const newProgress = Math.round(
      (completedCount / updatedLessons.length) * 100
    );
    setProgress(newProgress);

    // Update progress in backend (TODO: implement API endpoint)
    try {
      const token = localStorage.getItem("accessToken");
      if (token) {
        // await fetch(apiUrl(`chama/${chamaId}/classroom/courses/${course.id}/progress`), {
        //   method: 'PUT',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     Authorization: `Bearer ${token}`,
        //   },
        //   body: JSON.stringify({ progress: newProgress }),
        // });
      }
    } catch (error) {
      console.error("Failed to update progress:", error);
    }
  };

  // Media player controls
  const togglePlayPause = () => {
    if (course.fileType === "video" && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (course.fileType === "audio" && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (course.fileType === "video" && videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    } else if (course.fileType === "audio" && audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const getThumbnailUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (url.includes("localhost:4000")) {
        return url.replace(
          "localhost:4000",
          API_BASE_URL.replace(/^https?:\/\//, "")
        );
      }
      return url;
    }
    if (url.startsWith("/uploads")) {
      return `${API_BASE_URL}${url}`;
    }
    return `${API_BASE_URL}/uploads/${url}`;
  };

  const getFileUrl = (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (url.includes("localhost:4000")) {
        return url.replace(
          "localhost:4000",
          API_BASE_URL.replace(/^https?:\/\//, "")
        );
      }
      return url;
    }
    if (url.startsWith("/uploads")) {
      return `${API_BASE_URL}${url}`;
    }
    return `${API_BASE_URL}/uploads/${url}`;
  };

  return (
    <div className="w-full bg-white flex flex-col pb-14 md:pb-0 rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-3 md:px-4 py-2 md:py-3 bg-white sticky top-0 z-10 rounded-t-lg">
        {/* Mobile: Title on top, then progress below */}
        <div className="md:hidden flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1 text-gray-600">
              <X className="w-4 h-4" />
            </button>
            <h1 className="text-sm font-semibold text-gray-900 flex-1 line-clamp-2">
              {course.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 px-9">
            <span className="text-xs text-gray-600">Progress:</span>
            <span className="text-xs font-medium text-gray-900">
              {progress}%
            </span>
            <div className="flex-1 max-w-[200px]">
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-[#083232] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        {/* Desktop: Title and progress side by side */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-base md:text-lg font-semibold text-gray-900">
              {course.title}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm text-gray-600">
                Progress:
              </span>
              <span className="text-xs md:text-sm font-medium text-gray-900">
                {progress}%
              </span>
            </div>
            <div className="w-32">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[#083232] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-[600px]">
        {/* Left Sidebar - Navigation */}
        <div className="hidden md:block w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto flex-shrink-0">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Lessons
            </h2>
            <div className="space-y-1">
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  onClick={() => setActiveLesson(index)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeLesson === index
                      ? "bg-[#083232] text-white"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {lesson.completed && (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{lesson.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-white min-w-0">
          {/* Mobile lesson selector */}
          <div className="md:hidden border-b border-gray-200 bg-gray-50 p-4">
            <select
              value={activeLesson}
              onChange={(e) => setActiveLesson(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              {lessons.map((lesson, index) => (
                <option key={lesson.id} value={index}>
                  {lesson.completed && "✓ "}
                  {lesson.title}
                </option>
              ))}
            </select>
          </div>
          {course.fileType === "video" && (
            <div className="relative bg-black">
              <video
                ref={videoRef}
                src={getFileUrl(course.fileUrl)}
                className="w-full h-auto max-h-[60vh]"
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  setCurrentTime(video.currentTime);
                  setDuration(video.duration);
                }}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration);
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  // Mark lesson as complete when video ends
                  if (lessons[activeLesson]) {
                    markLessonComplete(lessons[activeLesson].id);
                  }
                }}
              />
              {/* Video Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 md:p-4">
                <div className="flex items-center gap-1 md:gap-2">
                  <button onClick={togglePlayPause} className="p-1 text-white">
                    {isPlaying ? (
                      <Pause className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <Play className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </button>
                  <button onClick={toggleMute} className="p-1 text-white">
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </button>
                  <div className="flex-1 text-white text-[10px] md:text-xs">
                    {Math.floor(currentTime / 60)}:
                    {String(Math.floor(currentTime % 60)).padStart(2, "0")} /{" "}
                    {Math.floor(duration / 60)}:
                    {String(Math.floor(duration % 60)).padStart(2, "0")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {course.fileType === "audio" && (
            <div className="bg-gray-900 p-4 md:p-8">
              <div className="max-w-2xl mx-auto">
                {course.thumbnailUrl && (
                  <img
                    src={getThumbnailUrl(course.thumbnailUrl)}
                    alt={course.title}
                    className="w-full h-48 md:h-64 object-cover rounded-lg mb-4 md:mb-6"
                  />
                )}
                <div className="flex items-center justify-center gap-2 md:gap-4">
                  <button onClick={togglePlayPause} className="p-1 text-white">
                    {isPlaying ? (
                      <Pause className="w-6 h-6 md:w-8 md:h-8" />
                    ) : (
                      <Play className="w-6 h-6 md:w-8 md:h-8" />
                    )}
                  </button>
                  <button onClick={toggleMute} className="p-1 text-white">
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </button>
                  <div className="flex-1 text-white text-[10px] md:text-sm">
                    {Math.floor(currentTime / 60)}:
                    {String(Math.floor(currentTime % 60)).padStart(2, "0")} /{" "}
                    {Math.floor(duration / 60)}:
                    {String(Math.floor(duration % 60)).padStart(2, "0")}
                  </div>
                </div>
                <audio
                  ref={audioRef}
                  src={getFileUrl(course.fileUrl)}
                  onTimeUpdate={(e) => {
                    const audio = e.currentTarget;
                    setCurrentTime(audio.currentTime);
                    setDuration(audio.duration);
                  }}
                  onLoadedMetadata={(e) => {
                    setDuration(e.currentTarget.duration);
                  }}
                  onEnded={() => {
                    setIsPlaying(false);
                    if (lessons[activeLesson]) {
                      markLessonComplete(lessons[activeLesson].id);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {course.fileType === "pdf" && course.thumbnailUrl && (
            <div className="w-full h-64 overflow-hidden">
              <img
                src={getThumbnailUrl(course.thumbnailUrl)}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Course Content */}
          <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
            <div className="mb-6">
              <h2 className="text-sm md:text-xl lg:text-2xl font-semibold md:font-bold text-gray-900 mb-2 md:mb-4">
                {lessons[activeLesson]?.title || "Course Content"}
              </h2>
              {lessons[activeLesson]?.content && (
                <div className="text-gray-700 space-y-2 md:space-y-4">
                  {lessons[activeLesson].content
                    .split("\n")
                    .map((line, index) => {
                      const trimmedLine = line.trim();
                      if (!trimmedLine) return <br key={index} />;

                      // Format headings
                      if (trimmedLine.match(/^#{1,3}\s+/)) {
                        const level = trimmedLine.match(/^#+/)?.[0].length || 1;
                        const text = trimmedLine.replace(/^#+\s+/, "");
                        const headingLevel = Math.min(level + 2, 6);
                        const className = `font-semibold md:font-bold text-gray-900 mt-4 md:mt-6 mb-2 md:mb-3 ${
                          level === 1
                            ? "text-base md:text-xl"
                            : level === 2
                            ? "text-sm md:text-lg"
                            : "text-xs md:text-base"
                        }`;

                        // Use React.createElement to avoid JSX namespace issues
                        const HeadingComponent = `h${headingLevel}` as
                          | "h1"
                          | "h2"
                          | "h3"
                          | "h4"
                          | "h5"
                          | "h6";
                        return (
                          <HeadingComponent key={index} className={className}>
                            {text}
                          </HeadingComponent>
                        );
                      }

                      // Format bullet points
                      if (trimmedLine.match(/^[-*•]\s+/)) {
                        const text = trimmedLine.replace(/^[-*•]\s+/, "");
                        return (
                          <div
                            key={index}
                            className="flex items-start gap-1.5 md:gap-2 ml-3 md:ml-4"
                          >
                            <span className="text-gray-500 mt-0.5 md:mt-1 text-xs">
                              •
                            </span>
                            <span className="text-xs md:text-sm">{text}</span>
                          </div>
                        );
                      }

                      // Format numbered lists
                      if (trimmedLine.match(/^\d+\.\s+/)) {
                        const text = trimmedLine.replace(/^\d+\.\s+/, "");
                        return (
                          <div
                            key={index}
                            className="flex items-start gap-1.5 md:gap-2 ml-3 md:ml-4"
                          >
                            <span className="text-gray-500 mt-0.5 md:mt-1 font-medium text-xs">
                              {trimmedLine.match(/^\d+\./)?.[0]}
                            </span>
                            <span className="text-xs md:text-sm">{text}</span>
                          </div>
                        );
                      }

                      // Regular paragraph
                      return (
                        <p
                          key={index}
                          className="leading-relaxed text-xs md:text-sm"
                        >
                          {trimmedLine}
                        </p>
                      );
                    })}
                </div>
              )}
              {!lessons[activeLesson]?.content && course.description && (
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-xs md:text-sm">
                  {course.description}
                </div>
              )}
            </div>

            {course.fileType === "pdf" && (
              <div className="mt-4 md:mt-6 border border-gray-200 rounded-lg overflow-hidden">
                <iframe
                  src={getFileUrl(course.fileUrl)}
                  className="w-full h-[400px] md:h-[600px]"
                  title={course.title}
                />
              </div>
            )}

            {/* Mark as Complete Button */}
            {lessons[activeLesson] && !lessons[activeLesson].completed && (
              <div className="mt-4 md:mt-6">
                <button
                  onClick={() => markLessonComplete(lessons[activeLesson].id)}
                  className="text-xs md:text-sm text-gray-700 flex items-center gap-1.5 md:gap-2"
                >
                  <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                  Mark as Complete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
