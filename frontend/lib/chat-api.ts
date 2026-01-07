// Frontend Chat API Client
import { apiUrl } from "./api-config";

interface SendMessageDto {
  recipientId: string;
  chamaId: string;
  content: string;
  messageType?: "text" | "image" | "file";
}

interface Message {
  id: string;
  content: string;
  message_type: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  is_read: boolean;
  created_at: string;
  is_sent_by_me: boolean;
}

interface Conversation {
  conversation_id: string;
  chama_id: string;
  chama_name: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar?: string;
  last_message: string;
  last_message_at: string;
  is_sent_by_me: boolean;
  unread_count: number;
  updated_at: string;
}

interface ChamaMember {
  id: string;
  full_name: string;
  profile_picture?: string;
  role: string;
  status: string;
}

class ChatApiClient {
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem("accessToken");
    // Use centralized apiUrl helper, but remove leading /api/v1 if present
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    cleanEndpoint = cleanEndpoint.replace(/^(api\/v1\/)+/, '').replace(/^(api\/)+/, '');
    const fullUrl = apiUrl(cleanEndpoint);
    console.log(`[ChatAPI] Making request to: ${fullUrl}`);
    
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Request failed" }));
        
        // Handle rate limit errors gracefully
        if (response.status === 429) {
          console.warn(`Chat API Rate Limit (429): ${error.message || "Too many requests"}`);
          throw new Error(error.message || "Rate limit exceeded. Please wait a moment and try again.");
        }
        
        console.error(`Chat API Error (${response.status}):`, error);
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      // Handle network errors (backend not running, CORS, etc.)
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        console.error(`[ChatAPI] Network error - Backend may not be running or CORS issue. URL: ${fullUrl}`);
        throw new Error(`Cannot connect to backend. Please ensure the backend server is running at ${fullUrl.split('/api')[0]}`);
      }
      throw error;
    }
  }

  // Send a message
  async sendMessage(
    dto: SendMessageDto
  ): Promise<{ message: Message; conversationId: string }> {
    return this.makeRequest("/chat/messages", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  }

  // Get conversations (chat list)
  async getConversations(chamaId?: string): Promise<Conversation[]> {
    const query = chamaId ? `?chamaId=${chamaId}` : "";
    return this.makeRequest(`/chat/conversations${query}`);
  }

  // Get messages in a conversation
  async getMessages(
    conversationId: string,
    limit = 50,
    offset = 0
  ): Promise<Message[]> {
    return this.makeRequest(
      `/chat/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`
    );
  }

  // Get chama members available for chat
  async getChamaMembers(chamaId: string): Promise<ChamaMember[]> {
    return this.makeRequest(`/chat/chamas/${chamaId}/members`);
  }

  // Get unread message count
  async getUnreadCount(chamaId?: string): Promise<{ unread_count: number }> {
    const query = chamaId ? `?chamaId=${chamaId}` : "";
    return this.makeRequest(`/chat/unread${query}`);
  }
}

export const chatApi = new ChatApiClient();
export type { SendMessageDto, Message, Conversation, ChamaMember };
