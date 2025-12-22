"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Send,
  ArrowLeft,
  Users,
  MessageCircle,
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

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessage?: () => void;
}

type View = "conversations" | "messages" | "new-chat";

export function ChatModal({ isOpen, onClose, onNewMessage }: ChatModalProps) {
  const [currentView, setCurrentView] = useState<View>("conversations");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [chamaMembers, setChamaMembers] = useState<ChamaMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingRecipient, setPendingRecipient] = useState<any>(null);

  const { chamas } = useChamas();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Check for pending message from profile page
      const pendingMessageStr = localStorage.getItem("pendingMessage");
      if (pendingMessageStr) {
        try {
          const pending = JSON.parse(pendingMessageStr);
          setPendingRecipient(pending);
          // Clear the pending message
          localStorage.removeItem("pendingMessage");
          // Set view to new-chat
          setCurrentView("new-chat");
          // Fetch members for the chama
          fetchChamaMembers(pending.chamaId);
        } catch (error) {
          console.error("Error parsing pending message:", error);
          fetchConversations();
        }
      } else {
        fetchConversations();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages]);

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
        handleStartNewChat(targetMember, pendingRecipient.chamaId);
        setPendingRecipient(null);
      }
    }
  }, [pendingRecipient, chamaMembers, currentView]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await chatApi.getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchChamaMembers = async (chamaId: string) => {
    try {
      setLoading(true);
      const data = await chatApi.getChamaMembers(chamaId);
      setChamaMembers(data);
    } catch (error) {
      console.error("Failed to fetch chama members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const result = await chatApi.sendMessage({
        recipientId: selectedConversation.other_user_id,
        chamaId: selectedConversation.chama_id,
        content: newMessage.trim(),
      });

      // Add message to current messages list
      setMessages((prev) => [...prev, result.message]);
      setNewMessage("");

      // Refresh conversations to update last message
      fetchConversations();

      // Notify parent component
      onNewMessage?.();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleStartNewChat = async (member: ChamaMember, chamaId: string) => {
    try {
      // Send initial message to create conversation
      const result = await chatApi.sendMessage({
        recipientId: member.id,
        chamaId,
        content: "Hi! 👋",
      });

      // Switch to conversation view
      const conversation: Conversation = {
        conversation_id: result.conversationId,
        chama_id: chamaId,
        chama_name: chamas.find((c) => c.id === chamaId)?.name || "",
        other_user_id: member.id,
        other_user_name: member.full_name,
        other_user_avatar: member.profile_picture,
        last_message: "Hi! 👋",
        last_message_at: new Date().toISOString(),
        is_sent_by_me: true,
        unread_count: 0,
        updated_at: new Date().toISOString(),
      };

      setSelectedConversation(conversation);
      setMessages([result.message]);
      setCurrentView("messages");
      fetchConversations();
      onNewMessage?.();
    } catch (error) {
      console.error("Failed to start new chat:", error);
    }
  };

  const handleConversationClick = (conversation: Conversation) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-[400px] h-[530px] p-0 gap-0 fixed bottom-0 right-6 top-auto left-auto transform-none m-0 translate-x-0 translate-y-0 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
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
              title="Collapse chat"
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
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleConversationClick(conversation)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conversation.other_user_avatar} />
                          <AvatarFallback>
                            {conversation.other_user_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">
                              {conversation.other_user_name}
                            </p>
                            <span className="text-xs text-gray-500">
                              {formatTime(conversation.last_message_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600 truncate">
                              {conversation.is_sent_by_me && "You: "}
                              {conversation.last_message}
                            </p>
                            {conversation.unread_count > 0 && (
                              <Badge variant="destructive" className="ml-2">
                                {conversation.unread_count}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
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
                <div className="p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.is_sent_by_me ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                          message.is_sent_by_me
                            ? "bg-[#083232] text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <p>{message.content}</p>
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
