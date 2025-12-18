import React, { useState, useEffect } from "react";
import { ReputationCard } from "./reputation-card";
import { BadgeGrid } from "./badge";
import { Leaderboard } from "./leaderboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trophy, Award, BarChart3, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReputationPageProps {
  chamaId: string;
  userId: string;
  isAdmin?: boolean;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export function ReputationPage({
  chamaId,
  userId,
  isAdmin = false,
}: ReputationPageProps) {
  const [reputation, setReputation] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchReputation();
    fetchBadges();
    fetchHistory();
  }, [chamaId, userId]);

  const fetchReputation = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${API_BASE_URL}/reputation/${chamaId}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReputation(data.reputation);
      }
    } catch (err) {
      console.error("Error fetching reputation:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBadges = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE_URL}/reputation/${chamaId}/badges/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBadges(data.badges || []);
      }
    } catch (err) {
      console.error("Error fetching badges:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE_URL}/reputation/${chamaId}/history/${userId}?limit=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const recalculateReputation = async () => {
    try {
      setCalculating(true);
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE_URL}/reputation/${chamaId}/calculate/${userId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Reputation recalculated successfully",
        });
        await fetchReputation();
        await fetchBadges();
        await fetchHistory();
      } else {
        throw new Error("Failed to recalculate");
      }
    } catch (err) {
      console.error("Error recalculating reputation:", err);
      toast({
        title: "Error",
        description: "Failed to recalculate reputation",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const recalculateAllMembers = async () => {
    try {
      setCalculating(true);
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${API_BASE_URL}/reputation/${chamaId}/calculate-all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Reputation recalculated for all members",
        });
        await fetchReputation();
      } else {
        throw new Error("Failed to recalculate");
      }
    } catch (err) {
      console.error("Error recalculating reputation:", err);
      toast({
        title: "Error",
        description: "Failed to recalculate reputation for all members",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-[1085px] mx-auto px-4 py-8">
        <div className="text-center py-8 text-gray-500">
          Loading reputation data...
        </div>
      </div>
    );
  }

  if (!reputation) {
    return (
      <div className="w-full max-w-[1085px] mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-gray-600">Community content coming soon</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-[600px]">
          <TabsTrigger value="overview">
            <Trophy className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="badges">
            <Award className="mr-2 h-4 w-4" />
            Badges
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <BarChart3 className="mr-2 h-4 w-4" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="w-full space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-[#083232]">My Reputation</h1>
            <Button
              onClick={recalculateReputation}
              disabled={calculating}
              variant="outline"
              size="sm"
            >
              {calculating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>

          <ReputationCard reputation={reputation} badges={badges} size="full" />

          {isAdmin && (
            <Card className="w-full p-6 bg-gradient-to-br from-[#083232]/5 to-[#2e856e]/5">
              <h3 className="text-lg font-semibold text-[#083232] mb-4">
                Admin Actions
              </h3>
              <Button
                onClick={recalculateAllMembers}
                disabled={calculating}
                className="bg-[#083232] hover:bg-[#2e856e]"
              >
                {calculating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Recalculate All Members
                  </>
                )}
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="badges" className="w-full space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-[#083232]">My Badges</h1>
            <div className="text-right">
              <p className="text-3xl font-bold text-[#083232]">
                {badges.length}
              </p>
              <p className="text-sm text-gray-600">Badges Earned</p>
            </div>
          </div>

          <Card className="w-full p-6">
            <BadgeGrid badges={badges} size="lg" />
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="w-full">
          <h1 className="text-3xl font-bold text-[#083232] mb-6">
            Leaderboard
          </h1>
          <Leaderboard chamaId={chamaId} currentUserId={userId} />
        </TabsContent>

        <TabsContent value="history" className="w-full space-y-6">
          <h1 className="text-3xl font-bold text-[#083232]">
            Reputation History
          </h1>

          <Card className="w-full p-6">
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="mx-auto mb-2 text-gray-400" size={48} />
                <p>No reputation history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((event: any) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        event.points_change > 0
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      <span className="text-lg font-bold">
                        {event.points_change > 0 ? "+" : ""}
                        {event.points_change}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[#083232]">
                          {event.event_type.replace("_", " ")}
                        </h4>
                        {event.event_subtype && (
                          <span className="text-xs px-2 py-1 bg-gray-200 rounded-full">
                            {event.event_subtype}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                        <span>
                          {new Date(event.created_at).toLocaleDateString()}
                        </span>
                        <span>
                          Score: {event.score_before} → {event.score_after}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
