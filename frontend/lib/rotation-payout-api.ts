/* eslint-disable @typescript-eslint/no-explicit-any */
// API client for rotation and payout operations

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

const apiClient = {
  post: async (url: string, data: any) => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      throw new Error("Not authenticated. Please login again.");
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/auth/login";
        throw new Error("Session expired. Please login again.");
      }
      const error = await response.json();
      throw new Error(error.message || "Request failed");
    }
    return { data: await response.json() };
  },
  get: async (url: string, params?: any) => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      throw new Error("Not authenticated. Please login again.");
    }

    let queryString = "";
    if (params) {
      const filteredParams: any = {};
      // Only include defined, non-null, non-empty values
      Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value !== undefined && value !== null && value !== "") {
          filteredParams[key] = value;
        }
      });
      const searchParams = new URLSearchParams();
      Object.entries(filteredParams).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      queryString = searchParams.toString()
        ? "?" + searchParams.toString()
        : "";
    }

    const response = await fetch(`${API_BASE_URL}${url}${queryString}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/auth/login";
        throw new Error("Session expired. Please login again.");
      }
      const error = await response.json();
      throw new Error(error.message || "Request failed");
    }
    return { data: await response.json() };
  },
};

// ==========================================
// ROTATION API
// ==========================================

export interface CreateRotationOrderDto {
  chamaId: string;
  rotationType: "sequential" | "random" | "merit_based" | "custom";
  cycleDurationMonths: number;
  startDate: string;
  customOrder?: string[]; // Array of member IDs for custom rotation
}

export interface RotationPosition {
  id: string;
  rotationOrderId: string;
  memberId: string;
  position: number;
  status: "pending" | "current" | "completed" | "skipped";
  meritScore?: number;
  assignedAt: string;
  completedAt?: string;
  skippedReason?: string;
  // Joined fields
  fullName: string;
  phone: string;
  email: string;
}

export interface RotationStatus {
  hasRotation: boolean;
  rotation: {
    id: string;
    chamaId: string;
    rotationType: string;
    currentPosition: number;
    totalPositions: number;
    status: string;
    startDate: string;
    completedAt?: string;
  } | null;
  positions: RotationPosition[];
  currentCycle?: {
    id: string;
    chamaId: string;
    cycleNumber: number;
    expectedAmount: number;
    startDate: string;
    dueDate: string;
    status: string;
    currentRecipient: {
      id: string;
      name: string;
      positionId: string;
    } | null;
    contributions: Array<{
      memberId: string;
      userId: string;
      userName: string;
      expectedAmount: number;
      paidAmount: number;
      lateFee: number;
      isPaid: boolean;
      paymentDate: string | null;
    }>;
  } | null;
  cycles?: any; // For backward compatibility
  progress: {
    currentPosition: number;
    totalPositions: number;
    completedCount: number;
    skippedCount: number;
    remainingCount: number;
  };
}

export interface NextRecipient {
  nextRecipient: {
    positionId: string;
    memberId: string;
    userId: string;
    fullName: string;
    phone: string;
    email: string;
    position: number;
    totalPositions: number;
  } | null;
}

export const rotationApi = {
  // Create rotation order
  async createRotation(dto: CreateRotationOrderDto) {
    const response = await apiClient.post(
      `/chama/${dto.chamaId}/rotation/create`,
      dto
    );
    return response.data;
  },

  // Get rotation status
  async getRotationStatus(chamaId: string): Promise<RotationStatus> {
    const response = await apiClient.get(`/chama/${chamaId}/rotation`);
    return response.data;
  },

  // Get all rotation positions
  async getRotationPositions(chamaId: string): Promise<RotationPosition[]> {
    const response = await apiClient.get(
      `/chama/${chamaId}/rotation/positions`
    );
    return response.data;
  },

  // Get next recipient
  async getNextRecipient(chamaId: string): Promise<NextRecipient> {
    const response = await apiClient.get(`/chama/${chamaId}/rotation/next`);
    return response.data;
  },

  // Skip position
  async skipPosition(positionId: string, reason: string) {
    const response = await apiClient.post(`/chama/rotation/skip`, {
      positionId,
      reason,
    });
    return response.data;
  },

  // Swap positions
  async swapPositions(
    position1Id: string,
    position2Id: string,
    reason: string
  ) {
    const response = await apiClient.post(`/chama/rotation/swap`, {
      position1Id,
      position2Id,
      reason,
    });
    return response.data;
  },
};

// ==========================================
// PAYOUT API
// ==========================================

export interface SchedulePayoutDto {
  cycleId: string;
  recipientId: string;
  amount: number;
  scheduledAt: string;
}

export interface Payout {
  id: string;
  chamaId: string;
  cycleId: string;
  recipientMemberId: string;
  recipientUserId: string;
  recipientName: string;
  recipientPhone: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  scheduledAt: string;
  executedAt?: string;
  failedReason?: string;
  transactionId?: string;
  cycleNumber: number;
  chamaName: string;
  contributionCount?: number;
}

export interface PayoutDetails {
  payout: Payout;
  distributions: Array<{
    id: string;
    contributionId: string;
    amount: number;
    contributorName: string;
    createdAt: string;
  }>;
  summary: {
    totalContributions: number;
    totalAmount: number;
    status: string;
  };
}

export interface PayoutHistoryQuery {
  chamaId?: string;
  cycleId?: string;
  recipientId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface PayoutHistoryResponse {
  payouts: Payout[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PayoutSummary {
  total_payouts: number;
  completed_count: number;
  pending_count: number;
  failed_count: number;
  total_paid: number;
  pending_amount: number;
}

export const payoutApi = {
  // Schedule payout
  async schedulePayout(dto: SchedulePayoutDto) {
    const response = await apiClient.post("/chama/payouts/schedule", dto);
    return response.data;
  },

  // Execute payout
  async executePayout(payoutId: string) {
    const response = await apiClient.post(
      `/chama/payouts/${payoutId}/execute`,
      {}
    );
    return response.data;
  },

  // Cancel payout
  async cancelPayout(payoutId: string, reason?: string) {
    const response = await apiClient.post(`/chama/payouts/${payoutId}/cancel`, {
      reason,
    });
    return response.data;
  },

  // Retry payout
  async retryPayout(payoutId: string) {
    const response = await apiClient.post(
      `/chama/payouts/${payoutId}/retry`,
      {}
    );
    return response.data;
  },

  // Get payout history
  async getPayoutHistory(
    filters: PayoutHistoryQuery
  ): Promise<PayoutHistoryResponse> {
    const response = await apiClient.get("/chama/payouts/history", filters);
    return response.data;
  },

  // Get payout details
  async getPayoutDetails(payoutId: string): Promise<PayoutDetails> {
    const response = await apiClient.get(`/chama/payouts/${payoutId}`);
    return response.data;
  },

  // Get upcoming payouts
  async getUpcomingPayouts(chamaId: string): Promise<Payout[]> {
    const response = await apiClient.get(`/chama/${chamaId}/payouts/upcoming`);
    return response.data;
  },

  // Get payout summary
  async getPayoutSummary(chamaId: string): Promise<PayoutSummary> {
    const response = await apiClient.get(`/chama/${chamaId}/payouts/summary`);
    return response.data;
  },

  // Process payout (manual trigger)
  async processPayout(params: {
    chamaId: string;
    rotationId: string;
    cycleId: string;
    recipientId: string;
    amount: number;
  }): Promise<{ payoutId: string; status: string }> {
    const response = await apiClient.post("/chama/payouts/process", params);
    return response.data;
  },
};
