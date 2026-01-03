"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  DollarSign,
  Percent,
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Shield,
  CheckCircle,
  ArrowRight,
  Filter,
  X,
  Award,
  UserCheck,
  Building2,
  MapPin,
  Star,
  Clock,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ExternalLoanApplicationForm } from "./external-loan-application-form";
import { Badge as ReputationBadge } from "@/components/reputation/badge";
import Link from "next/link";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ExternalLoanListing {
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
  requiresEmploymentVerification: boolean;
  requiresIncomeProof: boolean;
  minMonthlyIncome: number | null;
  allowsRiskSharing: boolean;
  maxCoFunders: number;
  status: string;
  totalApplications: number;
  totalApproved: number;
  totalFunded: number;
  averageInterestRate: number | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  chamaReputation?: {
    tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
    totalScore: number;
  };
}

export function ExternalMarketplace() {
  const router = useRouter();
  const { toast } = useToast();
  const [listings, setListings] = useState<ExternalLoanListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<ExternalLoanListing | null>(null);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [minInterestRate, setMinInterestRate] = useState<string>("");
  const [maxInterestRate, setMaxInterestRate] = useState<string>("");
  const [minPeriodMonths, setMinPeriodMonths] = useState<string>("");
  const [maxPeriodMonths, setMaxPeriodMonths] = useState<string>("");
  const [allowsRiskSharing, setAllowsRiskSharing] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;

  // Marketplace stats
  const [stats, setStats] = useState({
    verifiedChamas: 0,
    activeMembers: 0,
    loansDisbursed: 0,
    approvalRate: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const response = await fetch(apiUrl('lending/external/marketplace/stats'));

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setStats(data.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch marketplace stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M+`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K+`;
    }
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000000) {
      return `KSh ${(amount / 1000000000).toFixed(1)}B+`;
    } else if (amount >= 1000000) {
      return `KSh ${(amount / 1000000).toFixed(1)}M+`;
    } else if (amount >= 1000) {
      return `KSh ${(amount / 1000).toFixed(0)}K+`;
    }
    return `KSh ${formatAmount(amount)}`;
  };

  useEffect(() => {
    fetchListings();
    fetchStats();
  }, [currentPage, minAmount, maxAmount, minInterestRate, maxInterestRate, minPeriodMonths, maxPeriodMonths, allowsRiskSharing]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (minAmount) params.append("minAmount", minAmount);
      if (maxAmount) params.append("maxAmount", maxAmount);
      if (minInterestRate) params.append("minInterestRate", minInterestRate);
      if (maxInterestRate) params.append("maxInterestRate", maxInterestRate);
      if (minPeriodMonths) params.append("minPeriodMonths", minPeriodMonths);
      if (maxPeriodMonths) params.append("maxPeriodMonths", maxPeriodMonths);
      if (allowsRiskSharing !== "all") {
        params.append("allowsRiskSharing", allowsRiskSharing);
      }
      params.append("limit", itemsPerPage.toString());
      params.append("offset", ((currentPage - 1) * itemsPerPage).toString());

      const response = await fetch(
        apiUrl(`lending/external/marketplace?${params.toString()}`)
      );

      if (response.ok) {
        const data = await response.json();
        const fetchedListings = data.data || [];
        
        // Fetch reputation for each chama
        const listingsWithReputation = await Promise.all(
          fetchedListings.map(async (listing: ExternalLoanListing) => {
            try {
              const accessToken = localStorage.getItem("accessToken");
              const repResponse = await fetch(
                apiUrl(`reputation/${listing.chamaId}/summary`),
                {
                  headers: accessToken
                    ? { Authorization: `Bearer ${accessToken}` }
                    : {},
                }
              );

              if (repResponse.ok) {
                const repData = await repResponse.json();
                return {
                  ...listing,
                  chamaReputation: repData.reputation || repData.data?.reputation,
                };
              }
            } catch (err) {
              console.error(
                `Failed to fetch reputation for chama ${listing.chamaId}:`,
                err
              );
            }
            return listing;
          })
        );

        setListings(listingsWithReputation);
      } else {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        console.error("Failed to fetch listings:", response.status, errorData);
        throw new Error(errorData.message || `Failed to fetch listings: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to fetch listings:", error);
      toast({
        title: "Error",
        description: "Failed to load loan listings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (listing: ExternalLoanListing) => {
    // Check if user is authenticated
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      toast({
        title: "Authentication Required",
        description: "Please log in to apply for a loan",
        variant: "destructive",
      });
      router.push("/auth/login?redirect=/lending/marketplace");
      return;
    }

    setSelectedListing(listing);
    setShowApplicationDialog(true);
  };

  const handleApplicationSubmitted = () => {
    setShowApplicationDialog(false);
    setSelectedListing(null);
    toast({
      title: "Success",
      description: "Loan application submitted successfully",
    });
    // Optionally refresh listings
    fetchListings();
  };

  const clearFilters = () => {
    setMinAmount("");
    setMaxAmount("");
    setMinInterestRate("");
    setMaxInterestRate("");
    setMinPeriodMonths("");
    setMaxPeriodMonths("");
    setAllowsRiskSharing("all");
    setSearchQuery("");
  };

  // Filter listings by search query
  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        listing.title.toLowerCase().includes(query) ||
        listing.chamaName.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query)
      );
    });
  }, [listings, searchQuery]);

  // Sort listings
  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "interest_low":
          return a.interestRateMin - b.interestRateMin;
        case "interest_high":
          return b.interestRateMax - a.interestRateMax;
        case "amount_low":
          return a.minAmount - b.minAmount;
        case "amount_high":
          return b.maxAmount - a.maxAmount;
        case "applications":
          return b.totalApplications - a.totalApplications;
        default:
          return 0;
      }
    });
  }, [filteredListings, sortBy]);

  // Calculate pagination
  const totalFiltered = sortedListings.length;
  
  // Paginate sorted listings
  const paginatedListings = useMemo(() => {
    return sortedListings.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [sortedListings, currentPage, itemsPerPage]);

  // Update total pages when filtered results change
  useEffect(() => {
    const newTotalPages = Math.max(1, Math.ceil(totalFiltered / itemsPerPage));
    setTotalPages(newTotalPages);
  }, [totalFiltered, itemsPerPage]);

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loan Marketplace</h1>
        <p className="text-sm text-gray-600 mt-1">
          Browse and apply for loans from trusted chamas
        </p>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Verified Chamas
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? "..." : `${stats.verifiedChamas}%`}
                </p>
              </div>
              <div className="bg-gray-100 rounded-full p-2">
                <Shield className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Active Members
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? "..." : formatLargeNumber(stats.activeMembers)}
                </p>
              </div>
              <div className="bg-gray-100 rounded-full p-2">
                <UserCheck className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Loans Disbursed
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? "..." : formatCurrency(stats.loansDisbursed)}
                </p>
              </div>
              <div className="bg-gray-100 rounded-full p-2">
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Approval Rate
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? "..." : `${stats.approvalRate}%`}
                </p>
              </div>
              <div className="bg-gray-100 rounded-full p-2">
                <Award className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by chama name, title, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Toggle and Sort */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>
                {showFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-600">Sort by:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="w-4 h-4" />
                        Newest First
                      </div>
                    </SelectItem>
                    <SelectItem value="oldest">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="w-4 h-4" />
                        Oldest First
                      </div>
                    </SelectItem>
                    <SelectItem value="interest_low">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4" />
                        Lowest Interest
                      </div>
                    </SelectItem>
                    <SelectItem value="interest_high">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4" />
                        Highest Interest
                      </div>
                    </SelectItem>
                    <SelectItem value="amount_low">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Lowest Amount
                      </div>
                    </SelectItem>
                    <SelectItem value="amount_high">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Highest Amount
                      </div>
                    </SelectItem>
                    <SelectItem value="applications">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Most Applications
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <Label>Min Amount (Ksh)</Label>
                  <Input
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Max Amount (Ksh)</Label>
                  <Input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
                <div>
                  <Label>Min Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={minInterestRate}
                    onChange={(e) => setMinInterestRate(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Max Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={maxInterestRate}
                    onChange={(e) => setMaxInterestRate(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label>Min Period (Months)</Label>
                  <Input
                    type="number"
                    value={minPeriodMonths}
                    onChange={(e) => setMinPeriodMonths(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Max Period (Months)</Label>
                  <Input
                    type="number"
                    value={maxPeriodMonths}
                    onChange={(e) => setMaxPeriodMonths(e.target.value)}
                    placeholder="No limit"
                  />
                </div>
                <div>
                  <Label>Risk Sharing</Label>
                  <Select
                    value={allowsRiskSharing}
                    onValueChange={setAllowsRiskSharing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={fetchListings} className="w-full">
                    Apply Filters
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Listings Grid */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading listings...</p>
          </CardContent>
        </Card>
      ) : filteredListings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No listings found
            </h3>
            <p className="text-gray-600">
              {searchQuery || showFilters
                ? "Try adjusting your search or filters"
                : "No loan listings available at this time"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedListings.map((listing) => {
              const reputationScore = listing.chamaReputation?.totalScore || listing.totalApplications;
              const averageInterestRate = listing.averageInterestRate || 
                ((listing.interestRateMin + listing.interestRateMax) / 2);

              return (
                <Card
                  key={listing.id}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-5">
                    {/* Header with Icon, Name, Location, Reputation */}
                    <div className="mb-4">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {listing.chamaCoverImage ? (
                            <Image
                              src={listing.chamaCoverImage}
                              alt={listing.chamaName}
                              fill
                              className="object-cover"
                            />
                          ) : listing.chamaIcon ? (
                            <div className="w-full h-full flex items-center justify-center text-lg">
                              {listing.chamaIcon}
                            </div>
                          ) : (
                            <Building2 className="w-6 h-6 text-gray-700 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900 mb-1">
                            {listing.chamaName}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>Nairobi</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {listing.chamaReputation ? (
                                <>
                                  <ReputationBadge
                                    tier={listing.chamaReputation.tier}
                                    name=""
                                    size="sm"
                                    showLabel={false}
                                  />
                                  <span className="text-gray-500">
                                    Reputation {reputationScore > 0 ? reputationScore : ''}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-500">Reputation</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Key Details */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Interest Rate</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {averageInterestRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Max Loan</span>
                        <span className="text-sm font-semibold text-gray-900">
                          KSh {formatAmount(listing.maxAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Processing Time</span>
                        <span className="text-sm font-semibold text-gray-900">
                          2-3 days
                        </span>
                      </div>
                    </div>

                    {/* Apply Button */}
                    <Button
                      className="w-full bg-[#083232] hover:bg-[#2e856e]"
                      onClick={() => handleApply(listing)}
                    >
                      Apply Now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={
                        currentPage === pageNum
                          ? "bg-[#083232] hover:bg-[#2e856e]"
                          : ""
                      }
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Application Dialog */}
      {selectedListing && (
        <Dialog
          open={showApplicationDialog}
          onOpenChange={setShowApplicationDialog}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Apply for Loan</DialogTitle>
              <DialogDescription>
                Complete the form below to apply for a loan from{" "}
                {selectedListing.chamaName}
              </DialogDescription>
            </DialogHeader>
            <ExternalLoanApplicationForm
              listing={selectedListing}
              onSuccess={handleApplicationSubmitted}
              onCancel={() => setShowApplicationDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

