// Frontend Chat API Client

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
  private baseUrl = "http://localhost:3001/api";

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem("accessToken");
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
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
      console.error(`Chat API Error (${response.status}):`, error);
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
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
