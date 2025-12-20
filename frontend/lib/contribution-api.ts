// Backend API URL
const BACKEND_URL = "http://localhost:3001/api";

const apiClient = {
  post: async (url: string, data: any) => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      throw new Error("Not authenticated. Please login again.");
    }

    const response = await fetch(`${BACKEND_URL}${url}`, {
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
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return { data: await response.json() };
    }
    return { data: null };
  },

  get: async (url: string, params?: any) => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      throw new Error("Not authenticated. Please login again.");
    }

    const queryString = params?.params
      ? "?" + new URLSearchParams(params.params).toString()
      : "";
    const response = await fetch(`${BACKEND_URL}${url}${queryString}`, {
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
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return { data: await response.json(), status: response.status };
    }
    return { data: null, status: response.status };
  },

  put: async (url: string, data: any) => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      throw new Error("Not authenticated. Please login again.");
    }

    const response = await fetch(`${BACKEND_URL}${url}`, {
      method: "PUT",
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
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return { data: await response.json() };
    }
    return { data: null };
  },
};

export interface CreateContributionDto {
  chamaId: string;
  cycleId: string;
  amount: number;
  paymentMethod: "wallet" | "mpesa_direct" | "auto_debit";
  mpesaPhone?: string;
  notes?: string;
}

export interface ContributionHistoryQuery {
  chamaId?: string;
  cycleId?: string;
  memberId?: string;
  status?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface CycleSummary {
  cycle: {
    id: string;
    cycleNumber: number;
    expectedAmount: number;
    collectedAmount: number;
    dueDate: string;
    status: string;
    payout_executed_at?: string | null;
  };
  summary: {
    totalMembers: number;
    contributedMembers: number;
    pendingMembers: number;
    completionRate: number;
    totalCollected: number;
  };
  members: Array<{
    memberId: string;
    userId: string;
    fullName: string;
    hasContributed: boolean;
    contributedAmount?: number;
    contributedAt?: string;
  }>;
}

export interface SetupAutoDebitDto {
  chamaId: string;
  cycleId: string;
  amount: number | null;
  dayOfMonth: number;
  paymentMethod: "wallet" | "mpesa_direct";
}

export interface UpdateAutoDebitDto {
  amount?: number | null;
  dayOfMonth?: number;
  paymentMethod?: "wallet" | "mpesa_direct";
  enabled?: boolean;
}

export interface PenaltyWaiverDto {
  penaltyId: string;
  reason: string;
}

export interface VotePenaltyWaiverDto {
  waiverId: string;
  approve: boolean;
}

export const contributionApi = {
  // Create contribution
  async createContribution(dto: CreateContributionDto) {
    const response = await apiClient.post("/chama/contributions", dto);
    return response.data;
  },

  // Get contribution history
  async getContributionHistory(query: ContributionHistoryQuery) {
    const response = await apiClient.get("/chama/contributions", {
      params: query,
    });
    return response.data;
  },

  // Get cycle summary
  async getCycleSummary(cycleId: string): Promise<CycleSummary> {
    console.log("API: Calling GET /chama/cycles/${cycleId}/summary");
    const response = await apiClient.get(`/chama/cycles/${cycleId}/summary`);
    console.log("API: Response status:", response.status);
    console.log("API: Response data:", JSON.stringify(response.data, null, 2));
    return response.data;
  },

  // Setup auto-debit
  async setupAutoDebit(dto: SetupAutoDebitDto) {
    const response = await apiClient.post("/chama/auto-debit", dto);
    return response.data;
  },

  // Update auto-debit
  async updateAutoDebit(autoDebitId: string, dto: UpdateAutoDebitDto) {
    const response = await apiClient.put(
      `/chama/auto-debit/${autoDebitId}`,
      dto
    );
    return response.data;
  },

  // Get member penalties
  async getMemberPenalties(chamaId?: string) {
    const response = await apiClient.get("/chama/penalties", {
      params: { chamaId },
    });
    return response.data;
  },

  // Request penalty waiver
  async requestPenaltyWaiver(dto: PenaltyWaiverDto) {
    const response = await apiClient.post("/chama/penalties/waiver", dto);
    return response.data;
  },

  // Vote on penalty waiver
  async votePenaltyWaiver(dto: VotePenaltyWaiverDto) {
    const response = await apiClient.post("/chama/penalties/waiver/vote", dto);
    return response.data;
  },
};
