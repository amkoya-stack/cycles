"use client";

import React, { useState, useEffect } from "react";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/hooks/use-auth";
import {
  Search,
  Filter,
  Calculator,
  FileText,
  Settings,
  User,
  Building2,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-config";

interface UserProfile {
  id: string;
  full_name: string;
  fullName?: string;
  profile_photo_url?: string;
  profilePhotoUrl?: string;
}

interface LendingCycle {
  id: string;
  chamaId: string;
  chamaName: string;
  chamaCoverImage?: string | null;
  chamaIcon?: string | null;
  title: string;
  description: string | null;
  minAmount: number;
  maxAmount: number;
  interestRateMin: number;
  interestRateMax: number;
  minRepaymentPeriodMonths: number;
  maxRepaymentPeriodMonths: number;
  averageInterestRate: number | null;
  totalApplications: number;
  chamaReputation?: {
    tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
    totalScore: number;
  };
}

export default function MyLoansPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lendingCycles, setLendingCycles] = useState<LendingCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);

  // Mock loan data - replace with actual data from API
  const userData = {
    totalBorrowed: 15678,
    currentBorrow: 5500,
    currentEMI: 500,
    currentInterest: 678,
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserProfile();
      fetchLendingCycles();
    }
  }, [isAuthenticated]);

  // Helper function to get first name from full name
  const getFirstName = (fullName: string | undefined): string => {
    if (!fullName) return "";
    return fullName.trim().split(" ")[0];
  };

  const fetchUserProfile = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }

      const response = await fetch(apiUrl("auth/me"), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch profile:", response.status);
        return;
      }

      const data = await response.json();
      setUserProfile(data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLendingCycles = async () => {
    try {
      setCyclesLoading(true);
      const response = await fetch(
        apiUrl("lending/external/marketplace?limit=4"),
      );

      if (response.ok) {
        const data = await response.json();
        const cycles = data.data || [];
        setLendingCycles(cycles);
      } else {
        console.error("Failed to fetch lending cycles:", response.status);
      }
    } catch (error) {
      console.error("Error fetching lending cycles:", error);
    } finally {
      setCyclesLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
      />
      <main className="flex-1 pt-16 md:pt-20 pb-14">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* User Profile Card */}
          <div className="bg-gradient-to-br from-[#083232] to-[#0a4040] rounded-xl md:rounded-3xl p-6 mb-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
                  {userProfile?.profilePhotoUrl ||
                  userProfile?.profile_photo_url ? (
                    <img
                      src={
                        userProfile.profilePhotoUrl ||
                        userProfile.profile_photo_url
                      }
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg">
                    {getFirstName(
                      userProfile?.fullName || userProfile?.full_name,
                    )}
                  </h2>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-white/70 text-xs mb-1">Total Loan</p>
                <p className="text-white font-semibold text-base">
                  Ksh {userData.totalBorrowed.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-white/70 text-xs mb-1">Current Loan</p>
                <p className="text-white font-semibold text-base">
                  Ksh {userData.currentBorrow.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-white/70 text-xs mb-1">Current EMI</p>
                <p className="text-white font-semibold text-base">
                  Ksh {userData.currentEMI.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-white/70 text-xs mb-1">Current Interest</p>
                <p className="text-white font-semibold text-base">
                  Ksh {userData.currentInterest.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search here..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 rounded-2xl pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#083232]/30"
              />
            </div>
            <button className="bg-orange-500 hover:bg-orange-600 transition-colors rounded-2xl px-4 py-3 flex items-center justify-center">
              <Filter className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <button className="md:bg-gray-100 md:border md:border-gray-200 rounded-2xl p-3 flex flex-col items-center gap-2 md:hover:bg-gray-200 transition-colors">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <FileText className="w-5 h-5 text-[#083232]" />
              </div>
              <span className="text-gray-700 text-xs font-medium whitespace-nowrap">
                Report
              </span>
            </button>
            <button className="md:bg-gray-100 md:border md:border-gray-200 rounded-2xl p-3 flex flex-col items-center gap-2 md:hover:bg-gray-200 transition-colors">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Calculator className="w-5 h-5 text-[#083232]" />
              </div>
              <span className="text-gray-700 text-xs font-medium whitespace-nowrap">
                Calculate
              </span>
            </button>
            <button
              onClick={() => router.push("/lending/marketplace")}
              className="md:bg-gray-100 md:border md:border-gray-200 rounded-2xl p-3 flex flex-col items-center gap-2 md:hover:bg-gray-200 transition-colors"
            >
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <FileText className="w-5 h-5 text-[#083232]" />
              </div>
              <span className="text-gray-700 text-xs font-medium whitespace-nowrap">
                New Loan
              </span>
            </button>
            <button className="md:bg-gray-100 md:border md:border-gray-200 rounded-2xl p-3 flex flex-col items-center gap-2 md:hover:bg-gray-200 transition-colors">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Settings className="w-5 h-5 text-[#083232]" />
              </div>
              <span className="text-gray-700 text-xs font-medium whitespace-nowrap">
                Settings
              </span>
            </button>
          </div>

          {/* Promotional Banner */}
          <div className="bg-gradient-to-r from-[#0a5050] to-[#0d6060] rounded-3xl p-6 mb-6 border border-white/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-start gap-3 mb-3">
                <div className="text-3xl">💰</div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg mb-1">
                    Need a Loan? Start at Just 8% Interest!
                  </h3>
                  <p className="text-white/80 text-sm mb-4">
                    Apply now and get fast approval with low rates.
                  </p>
                  <button className="bg-white hover:bg-gray-100 transition-colors text-[#083232] font-semibold px-6 py-2 rounded-full text-sm">
                    Apply for Loan
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8"></div>
            <div className="absolute right-16 bottom-0 w-24 h-24 bg-white/5 rounded-full translate-y-8"></div>
          </div>

          {/* Top Lending Cycles Section */}
          <div className="mb-6">
            <h3 className="text-gray-900 font-bold text-xl mb-2">
              Top Lending Cycles
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Available lending cycles in your area
            </p>

            {cyclesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232] mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading lending cycles...</p>
              </div>
            ) : lendingCycles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No lending cycles available</p>
              </div>
            ) : (
              <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x snap-mandatory">
                {lendingCycles.map((cycle) => {
                  const reputationScore =
                    cycle.chamaReputation?.totalScore ||
                    cycle.totalApplications;
                  const averageInterestRate =
                    cycle.averageInterestRate ||
                    (cycle.interestRateMin + cycle.interestRateMax) / 2;

                  return (
                    <div
                      key={cycle.id}
                      className="bg-white border border-gray-200 rounded-lg hover:shadow-lg transition-shadow flex-shrink-0 w-[280px] snap-start"
                    >
                      <div className="p-5">
                        {/* Header with Icon, Name, Location, Reputation */}
                        <div className="mb-4">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              {cycle.chamaCoverImage ? (
                                <img
                                  src={cycle.chamaCoverImage}
                                  alt={cycle.chamaName}
                                  className="w-full h-full object-cover"
                                />
                              ) : cycle.chamaIcon ? (
                                <div className="w-full h-full flex items-center justify-center text-lg">
                                  {cycle.chamaIcon}
                                </div>
                              ) : (
                                <Building2 className="w-6 h-6 text-gray-700 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-base font-semibold text-gray-900 mb-1">
                                {cycle.chamaName}
                              </h3>
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>Nairobi</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">
                                    Reputation{" "}
                                    {reputationScore > 0 ? reputationScore : ""}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Key Details */}
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">
                              Interest Rate
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {averageInterestRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">
                              Max Loan
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              KSh {formatAmount(cycle.maxAmount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">
                              Processing Time
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              2-3 days
                            </span>
                          </div>
                        </div>

                        {/* Apply Button */}
                        <button
                          onClick={() =>
                            router.push(`/lending/listings/${cycle.id}`)
                          }
                          className="w-full bg-[#083232] hover:bg-[#2e856e] text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                          Apply Now
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* View More Button - Half Visible */}
                <button
                  onClick={() => router.push("/lending/marketplace")}
                  className="flex-shrink-0 w-[140px] bg-white border border-gray-200 rounded-lg hover:shadow-lg transition-shadow snap-start flex flex-col items-center justify-center gap-2 p-8"
                >
                  <div className="w-12 h-12 bg-[#083232] rounded-full flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[#083232] text-sm font-semibold">
                    View More
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
