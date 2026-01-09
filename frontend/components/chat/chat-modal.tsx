"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  ChevronDown,
  Send,
  ArrowLeft,
  Users,
  MessageCircle,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  chatApi,
  type Conversation,
  type Message,
  type ChamaMember,
} from "@/lib/chat-api";
import { useChamas } from "@/hooks/use-chamas";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api-config";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessage?: () => void;
  isPageMode?: boolean; // When true, renders as a page instead of a modal on mobile
  noOverlay?: boolean; // When true, renders without Dialog overlay/backdrop
}

type View = "conversations" | "messages" | "new-chat";

export function ChatModal({
  isOpen,
  onClose,
  onNewMessage,
  isPageMode = false,
  noOverlay = false,
}: ChatModalProps) {
  // Check for pendingMessage on mount to set initial view correctly
  const [currentView, setCurrentView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const pendingMessageStr = localStorage.getItem("pendingMessage");
      if (pendingMessageStr) {
        // If there's a pending message, start with messages view
        return "messages";
      }
    }
    return "conversations";
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [chamaMembers, setChamaMembers] = useState<ChamaMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingRecipient, setPendingRecipient] = useState<any>(null);
  const [currentUserChatEnabled, setCurrentUserChatEnabled] = useState<
    Record<string, boolean>
  >({});
  const [isMobile, setIsMobile] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const { chamas } = useChamas();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check chat settings before opening chat
  const checkChatSettingsBeforeOpen = async (
    chamaId: string,
    recipientId: string
  ): Promise<boolean> => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return false;

      // Get current user ID from token
      let currentUserId = "";
      try {
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        currentUserId = payload.sub || payload.userId || "";
      } catch (e) {
        console.error("Failed to parse token:", e);
        return false;
      }

      // Check current user's chat settings
      const currentUserResponse = await fetch(
        apiUrl(`activity/preferences/me?chamaId=${chamaId}`),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (currentUserResponse.ok) {
        const currentUserSettings = await currentUserResponse.json();
        if (currentUserSettings.chat_enabled === false) {
          toast({
            title: "Chat Disabled",
            description:
              "You have disabled chat messages. Please enable chat in Cycle Settings to send messages.",
            variant: "destructive",
          });
          return false;
        }
      }

      // Check recipient's chat settings
      const recipientResponse = await fetch(
        apiUrl(`chama/${chamaId}/members/${recipientId}/chat-settings`),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (recipientResponse.ok) {
        const recipientSettings = await recipientResponse.json();
        if (recipientSettings.chat_enabled === false) {
          toast({
            title: "Chat Disabled",
            description:
              "This member has disabled chat messages from other members.",
            variant: "destructive",
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to check chat settings:", error);
      // Default to allowing if check fails (to avoid blocking legitimate chats)
      return true;
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Check for pending message from profile page or member directory
      const pendingMessageStr = localStorage.getItem("pendingMessage");
      if (pendingMessageStr) {
        try {
          const pending = JSON.parse(pendingMessageStr);

          // Clear the pending message immediately to prevent re-processing
          localStorage.removeItem("pendingMessage");

          // Set initializing state to prevent shaking during setup
          setIsInitializing(true);

          // CRITICAL: Create temp conversation and set view to messages IMMEDIATELY
          // This ensures we never show the conversations list - go straight to inbox
          const chamaName =
            chamas.find((c) => c.id === pending.chamaId)?.name || "";
          const tempConversation: Conversation = {
            conversation_id: `temp-${pending.recipientId}-${pending.chamaId}`,
            chama_id: pending.chamaId,
            chama_name: chamaName,
            other_user_id: pending.recipientId,
            other_user_name: pending.recipientName || "User",
            other_user_avatar: pending.recipientAvatar,
            last_message: "",
            last_message_at: new Date().toISOString(),
            is_sent_by_me: false,
            unread_count: 0,
            updated_at: new Date().toISOString(),
          };

          // Set conversation and view immediately - inbox shows right away
          setSelectedConversation(tempConversation);
          setCurrentView("messages");
          setMessages([]);

          // Check chat settings first
          checkChatSettingsBeforeOpen(
            pending.chamaId,
            pending.recipientId
          ).then(async (canOpen) => {
            if (!canOpen) {
              // Chat is disabled, don't open modal
              setIsInitializing(false);
              onClose();
              return;
            }

            // Fetch conversations and find the specific one, then update if it exists
            try {
              // Fetch all conversations in the background (to populate state)
              const allConversations = await chatApi.getConversations();

              // Update conversations state in background
              setConversations(allConversations);

              // Find the specific conversation
              const existingConversation = allConversations.find(
                (conv) =>
                  conv.other_user_id === pending.recipientId &&
                  conv.chama_id === pending.chamaId
              );

              if (existingConversation) {
                // Conversation exists, update to real conversation and fetch messages
                setSelectedConversation(existingConversation);
                await fetchMessages(existingConversation.conversation_id);
                setIsInitializing(false);
              } else {
                // No existing conversation, keep the temp one we already set
                setIsInitializing(false);
              }
            } catch (error) {
              console.error("Failed to open conversation:", error);
              // Keep the temp conversation and messages view - don't switch to conversations
              setIsInitializing(false);
            }
          });
        } catch (error) {
          console.error("Error parsing pending message:", error);
          setIsInitializing(false);
          setCurrentView("conversations");
          fetchConversations();
        }
      } else {
        // Only fetch conversations if there's no pending message
        setIsInitializing(false);
        // Don't override if we're already in messages view (for pendingMessage case)
        setCurrentView((prev) => {
          // If we're in messages view, keep it (might be from pendingMessage)
          // Otherwise, go to conversations
          if (prev === "messages") {
            return prev;
          }
          return "conversations";
        });
        fetchConversations();
      }
    } else {
      // Reset state when modal closes, but preserve if there's a pending message
      const hasPendingMessage =
        typeof window !== "undefined" && localStorage.getItem("pendingMessage");
      if (!hasPendingMessage) {
        setIsInitializing(false);
        setPendingRecipient(null);
        setCurrentView("conversations");
        setSelectedConversation(null);
        setMessages([]);
        setChamaMembers([]);
      }
    }
  }, [isOpen, onClose, chamas]);

  useEffect(() => {
    // Scroll to bottom when messages change, but only if we're in messages view
    if (currentView === "messages" && messages.length > 0) {
      // Use requestAnimationFrame to prevent layout thrashing
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, currentView]);

  // Auto-start chat with pending recipient if available
  useEffect(() => {
    if (
      pendingRecipient &&
      currentView === "new-chat" &&
      chamaMembers.length > 0
    ) {
      const targetMember = chamaMembers.find(
        (m) => m.id === pendingRecipient.recipientId
      );
      if (targetMember) {
        // Use requestAnimationFrame to batch state updates and prevent shaking
        requestAnimationFrame(() => {
          handleStartNewChat(targetMember, pendingRecipient.chamaId);
          setPendingRecipient(null);
        });
      }
    }
  }, [pendingRecipient, chamaMembers, currentView]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await chatApi.getConversations();
      // Only update if data actually changed to prevent unnecessary re-renders
      setConversations((prev) => {
        // Simple check: if lengths differ or IDs differ, update
        if (prev.length !== data.length) {
          return data;
        }
        const prevIds = prev
          .map((c) => c.conversation_id)
          .sort()
          .join(",");
        const newIds = data
          .map((c) => c.conversation_id)
          .sort()
          .join(",");
        if (prevIds !== newIds) {
          return data;
        }
        // Check if any conversation data changed
        for (let i = 0; i < prev.length; i++) {
          if (
            prev[i].last_message !== data[i]?.last_message ||
            prev[i].unread_count !== data[i]?.unread_count ||
            prev[i].last_message_at !== data[i]?.last_message_at
          ) {
            return data;
          }
        }
        return prev; // No changes, return previous to prevent re-render
      });
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = async (conversationId: string) => {
    try {
      setLoading(true);
      const data = await chatApi.getMessages(conversationId);
      setMessages(data);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChamaMembers = useCallback(async (chamaId: string) => {
    try {
      setLoading(true);
      const data = await chatApi.getChamaMembers(chamaId);
      setChamaMembers(data);
    } catch (error) {
      console.error("Failed to fetch chama members:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const result = await chatApi.sendMessage({
        recipientId: selectedConversation.other_user_id,
        chamaId: selectedConversation.chama_id,
        content: newMessage.trim(),
      });

      // If this was a new conversation (temp ID), update with real conversation ID
      if (selectedConversation.conversation_id.startsWith("temp-")) {
        const updatedConversation: Conversation = {
          ...selectedConversation,
          conversation_id: result.conversationId,
        };
        setSelectedConversation(updatedConversation);
      }

      // Add message to current messages list
      setMessages((prev) => [...prev, result.message]);
      setNewMessage("");

      // Refresh conversations to update last message
      fetchConversations();

      // Notify parent component
      onNewMessage?.();
    } catch (error: any) {
      console.error("Failed to send message:", error);
      // Show error message to user
      const errorMessage =
        error?.message || "Failed to send message. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // If chat is disabled, close the modal after showing error
      if (
        errorMessage.includes("disabled chat") ||
        errorMessage.includes("Chat Disabled")
      ) {
        setTimeout(() => {
          onClose();
          setSelectedConversation(null);
          setCurrentView("conversations");
        }, 2000);
      }
    }
  };

  const handleStartNewChat = async (member: ChamaMember, chamaId: string) => {
    try {
      // Check chat settings before opening
      const canOpen = await checkChatSettingsBeforeOpen(chamaId, member.id);
      if (!canOpen) {
        // Chat is disabled, close modal
        onClose();
        return;
      }

      // Check if conversation already exists
      const existingConversations = await chatApi.getConversations(chamaId);
      const existingConversation = existingConversations.find(
        (conv) => conv.other_user_id === member.id && conv.chama_id === chamaId
      );

      if (existingConversation) {
        // Conversation exists, open it - batch state updates to prevent shaking
        setSelectedConversation(existingConversation);
        setCurrentView("messages");
        // Fetch messages after view is set to prevent layout shifts
        requestAnimationFrame(() => {
          fetchMessages(existingConversation.conversation_id);
        });
      } else {
        // No existing conversation, create a local conversation object
        // The conversation will be created on the backend when the user sends their first message
        const newConversation: Conversation = {
          conversation_id: `temp-${member.id}-${chamaId}`, // Temporary ID
          chama_id: chamaId,
          chama_name: chamas.find((c) => c.id === chamaId)?.name || "",
          other_user_id: member.id,
          other_user_name: member.full_name,
          other_user_avatar: member.profile_picture,
          last_message: "",
          last_message_at: new Date().toISOString(),
          is_sent_by_me: false,
          unread_count: 0,
          updated_at: new Date().toISOString(),
        };

        // Batch state updates together to prevent shaking
        setSelectedConversation(newConversation);
        setMessages([]); // Empty messages - user will type their first message
        setCurrentView("messages");
      }
    } catch (error) {
      console.error("Failed to start new chat:", error);
    }
  };

  const handleConversationClick = async (conversation: Conversation) => {
    // Check chat settings before opening conversation
    const canOpen = await checkChatSettingsBeforeOpen(
      conversation.chama_id,
      conversation.other_user_id
    );

    if (!canOpen) {
      return; // Don't open if chat is disabled
    }

    setSelectedConversation(conversation);
    setCurrentView("messages");
    fetchMessages(conversation.conversation_id);
  };

  const handleBack = () => {
    if (currentView === "messages") {
      setCurrentView("conversations");
      setSelectedConversation(null);
      setMessages([]);
    } else if (currentView === "new-chat") {
      setCurrentView("conversations");
      setChamaMembers([]);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  // On mobile in page mode, render without Dialog wrapper (no overlay)
  if (isPageMode && isMobile) {
    if (!isOpen) return null;

    return (
      <div className="w-full h-[calc(100vh-4rem)] md:hidden flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {currentView !== "conversations" && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h2 className="text-lg font-semibold">
              {currentView === "conversations" && "Messages"}
              {currentView === "messages" &&
                selectedConversation?.other_user_name}
              {currentView === "new-chat" && "New Chat"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {currentView === "conversations" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView("new-chat")}
              >
                <Users className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="Close chat"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {currentView === "conversations" && (
            <ScrollArea className="h-full">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-sm mt-2">
                    Start a new chat with your chama members
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.conversation_id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleConversationClick(conversation)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={conversation.other_user_avatar} />
                          <AvatarFallback>
                            {conversation.other_user_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {conversation.other_user_name}
                            </p>
                            <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                              {formatTime(conversation.last_message_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="text-sm text-gray-600 truncate flex-1 min-w-0">
                              {conversation.is_sent_by_me && "You: "}
                              {conversation.last_message}
                            </p>
                            {conversation.unread_count > 0 && (
                              <Badge
                                variant="destructive"
                                className="ml-2 flex-shrink-0"
                              >
                                {conversation.unread_count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {conversation.chama_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          {currentView === "messages" && selectedConversation && (
            <>
              {/* Messages */}
              <ScrollArea className="h-[calc(100%-80px)]">
                <div className="p-4 space-y-4 flex flex-col justify-end min-h-full">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.is_sent_by_me ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex items-end gap-2 max-w-[85%] ${
                          message.is_sent_by_me
                            ? "flex-row-reverse"
                            : "flex-row"
                        }`}
                      >
                        {!message.is_sent_by_me && (
                          <Avatar className="h-6 w-6 flex-shrink-0 mb-1">
                            <AvatarImage
                              src={selectedConversation?.other_user_avatar}
                            />
                            <AvatarFallback className="text-xs bg-gray-300">
                              {selectedConversation?.other_user_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`relative px-4 py-2 rounded-2xl text-sm break-words ${
                            message.is_sent_by_me
                              ? "bg-[#083232] text-white rounded-br-md"
                              : "bg-gray-200 text-gray-900 rounded-bl-md"
                          }`}
                        >
                          <p className="leading-relaxed">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.is_sent_by_me
                                ? "text-gray-300"
                                : "text-gray-500"
                            }`}
                          >
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {currentView === "new-chat" && (
            <div className="h-full">
              {/* Chama Selection */}
              <div className="p-4 border-b">
                <p className="text-sm text-gray-600 mb-3">
                  Select a chama to view members:
                </p>
                <div className="space-y-2">
                  {chamas.map((chama) => (
                    <Button
                      key={chama.id}
                      variant="outline"
                      size="sm"
                      onClick={() => fetchChamaMembers(chama.id)}
                      className="w-full justify-start"
                    >
                      {chama.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Members List */}
              <ScrollArea className="h-full">
                {chamaMembers.length > 0 && (
                  <div className="p-4">
                    <p className="text-sm font-medium mb-3">
                      Select member to chat with:
                    </p>
                    <div className="space-y-2">
                      {chamaMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() =>
                            handleStartNewChat(
                              member,
                              chamas.find((c) =>
                                chamaMembers.some((m) => m.id === member.id)
                              )?.id || ""
                            )
                          }
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profile_picture} />
                            <AvatarFallback>
                              {member.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {member.full_name}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {member.role}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render without Dialog overlay if noOverlay is true
  // This prevents the dark shadow/backdrop when opened from member directory
  if (noOverlay && isOpen) {
    return (
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <div className="pointer-events-auto fixed md:w-[400px] md:h-[530px] w-full h-full md:max-h-[530px] md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg bg-white flex flex-col shadow-2xl">
          {/* Show loading state during initialization to prevent shaking */}
          {isInitializing ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232] mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Opening chat...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  {currentView !== "conversations" && (
                    <Button variant="ghost" size="sm" onClick={handleBack}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <h2 className="text-lg font-semibold">
                    {currentView === "conversations" && "Messages"}
                    {currentView === "messages" &&
                      selectedConversation?.other_user_name}
                    {currentView === "new-chat" && "New Chat"}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {currentView === "conversations" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentView("new-chat")}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    title="Close chat"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Content - same as Dialog version below */}
              <div className="flex-1 overflow-hidden">
                {currentView === "conversations" && (
                  <ScrollArea className="h-full">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">
                        Loading conversations...
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No conversations yet</p>
                        <p className="text-sm mt-2">
                          Start a new chat with your chama members
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {conversations.map((conversation) => (
                          <div
                            key={conversation.conversation_id}
                            className="p-4 hover:bg-gray-50 cursor-pointer"
                            onClick={() =>
                              handleConversationClick(conversation)
                            }
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12 flex-shrink-0">
                                <AvatarImage
                                  src={conversation.other_user_avatar}
                                />
                                <AvatarFallback>
                                  {conversation.other_user_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-sm truncate">
                                    {conversation.other_user_name}
                                  </p>
                                  <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                                    {formatTime(conversation.last_message_at)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <p className="text-sm text-gray-600 truncate flex-1 min-w-0">
                                    {conversation.is_sent_by_me && "You: "}
                                    {conversation.last_message}
                                  </p>
                                  {conversation.unread_count > 0 && (
                                    <Badge
                                      variant="destructive"
                                      className="ml-2 flex-shrink-0"
                                    >
                                      {conversation.unread_count}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 truncate">
                                  {conversation.chama_name}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                )}

                {currentView === "messages" && selectedConversation && (
                  <>
                    <ScrollArea className="h-[calc(100%-80px)]">
                      <div className="p-4 space-y-4 flex flex-col justify-end min-h-full">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.is_sent_by_me
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`flex items-end gap-2 max-w-[85%] ${
                                message.is_sent_by_me
                                  ? "flex-row-reverse"
                                  : "flex-row"
                              }`}
                            >
                              {!message.is_sent_by_me && (
                                <Avatar className="h-6 w-6 flex-shrink-0 mb-1">
                                  <AvatarImage
                                    src={
                                      selectedConversation?.other_user_avatar
                                    }
                                  />
                                  <AvatarFallback className="text-xs bg-gray-300">
                                    {selectedConversation?.other_user_name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div
                                className={`relative px-4 py-2 rounded-2xl text-sm break-words ${
                                  message.is_sent_by_me
                                    ? "bg-[#083232] text-white rounded-br-md"
                                    : "bg-gray-200 text-gray-900 rounded-bl-md"
                                }`}
                              >
                                <p className="leading-relaxed">
                                  {message.content}
                                </p>
                                <p
                                  className={`text-xs mt-1 ${
                                    message.is_sent_by_me
                                      ? "text-gray-300"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {formatTime(message.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                    <div className="border-t p-4">
                      <div className="flex gap-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          onKeyPress={(e) =>
                            e.key === "Enter" && handleSendMessage()
                          }
                          className="flex-1"
                        />
                        <Button onClick={handleSendMessage} size="sm">
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {currentView === "new-chat" && (
                  <div className="h-full">
                    <div className="p-4 border-b">
                      <p className="text-sm text-gray-600 mb-3">
                        Select a chama to view members:
                      </p>
                      <div className="space-y-2">
                        {chamas.map((chama) => (
                          <Button
                            key={chama.id}
                            variant="outline"
                            size="sm"
                            onClick={() => fetchChamaMembers(chama.id)}
                            className="w-full justify-start"
                          >
                            {chama.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <ScrollArea className="h-full">
                      {chamaMembers.length > 0 && (
                        <div className="p-4">
                          <p className="text-sm font-medium mb-3">
                            Select member to chat with:
                          </p>
                          <div className="space-y-2">
                            {chamaMembers.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                onClick={() =>
                                  handleStartNewChat(
                                    member,
                                    chamas.find((c) =>
                                      chamaMembers.some(
                                        (m) => m.id === member.id
                                      )
                                    )?.id || ""
                                  )
                                }
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={member.profile_picture} />
                                  <AvatarFallback>
                                    {member.full_name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">
                                    {member.full_name}
                                  </p>
                                  <p className="text-xs text-gray-500 capitalize">
                                    {member.role}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="md:w-[400px] md:h-[530px] w-full h-[calc(100vh-4rem)] md:max-h-[530px] p-0 gap-0 fixed md:bottom-0 md:right-6 top-0 left-0 right-0 bottom-16 md:top-auto md:left-auto md:translate-x-0 md:translate-y-0 translate-x-0 translate-y-0 transform-none m-0 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300 rounded-none md:rounded-lg z-[60] max-w-none md:max-w-[400px]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {currentView === "conversations" && "Messages"}
          {currentView === "messages" && selectedConversation?.other_user_name}
          {currentView === "new-chat" && "New Chat"}
        </DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {currentView !== "conversations" && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h2 className="text-lg font-semibold">
              {currentView === "conversations" && "Messages"}
              {currentView === "messages" &&
                selectedConversation?.other_user_name}
              {currentView === "new-chat" && "New Chat"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {currentView === "conversations" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView("new-chat")}
              >
                <Users className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="Close chat"
              className="md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="Collapse chat"
              className="hidden md:flex"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {currentView === "conversations" && (
            <ScrollArea className="h-full">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No conversations yet</p>
                  <p className="text-sm mt-2">
                    Start a new chat with your chama members
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.conversation_id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleConversationClick(conversation)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={conversation.other_user_avatar} />
                          <AvatarFallback>
                            {conversation.other_user_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {conversation.other_user_name}
                            </p>
                            <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                              {formatTime(conversation.last_message_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="text-sm text-gray-600 truncate flex-1 min-w-0">
                              {conversation.is_sent_by_me && "You: "}
                              {conversation.last_message}
                            </p>
                            {conversation.unread_count > 0 && (
                              <Badge
                                variant="destructive"
                                className="ml-2 flex-shrink-0"
                              >
                                {conversation.unread_count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {conversation.chama_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          {currentView === "messages" && selectedConversation && (
            <>
              {/* Messages */}
              <ScrollArea className="h-[calc(100%-80px)]">
                <div className="p-4 space-y-4 flex flex-col justify-end min-h-full">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.is_sent_by_me ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex items-end gap-2 max-w-[85%] ${
                          message.is_sent_by_me
                            ? "flex-row-reverse"
                            : "flex-row"
                        }`}
                      >
                        {!message.is_sent_by_me && (
                          <Avatar className="h-6 w-6 flex-shrink-0 mb-1">
                            <AvatarImage
                              src={selectedConversation?.other_user_avatar}
                            />
                            <AvatarFallback className="text-xs bg-gray-300">
                              {selectedConversation?.other_user_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`relative px-4 py-2 rounded-2xl text-sm break-words ${
                            message.is_sent_by_me
                              ? "bg-[#083232] text-white rounded-br-md"
                              : "bg-gray-200 text-gray-900 rounded-bl-md"
                          }`}
                        >
                          <p className="leading-relaxed">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.is_sent_by_me
                                ? "text-gray-300"
                                : "text-gray-500"
                            }`}
                          >
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {currentView === "new-chat" && (
            <div className="h-full">
              {/* Chama Selection */}
              <div className="p-4 border-b">
                <p className="text-sm text-gray-600 mb-3">
                  Select a chama to view members:
                </p>
                <div className="space-y-2">
                  {chamas.map((chama) => (
                    <Button
                      key={chama.id}
                      variant="outline"
                      size="sm"
                      onClick={() => fetchChamaMembers(chama.id)}
                      className="w-full justify-start"
                    >
                      {chama.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Members List */}
              <ScrollArea className="h-full">
                {chamaMembers.length > 0 && (
                  <div className="p-4">
                    <p className="text-sm font-medium mb-3">
                      Select member to chat with:
                    </p>
                    <div className="space-y-2">
                      {chamaMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() =>
                            handleStartNewChat(
                              member,
                              chamas.find((c) =>
                                chamaMembers.some((m) => m.id === member.id)
                              )?.id || ""
                            )
                          }
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profile_picture} />
                            <AvatarFallback>
                              {member.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {member.full_name}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                              {member.role}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
