"use client";

import React, { useState, useEffect, useMemo } from "react";
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

  useEffect(() => {
    fetchListings();
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
        throw new Error("Failed to fetch listings");
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
        <h1 className="text-3xl font-bold text-gray-900">Loan Marketplace</h1>
        <p className="text-gray-600 mt-2">
          Browse and apply for loans from trusted chamas
        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedListings.map((listing) => (
            <Card
              key={listing.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg">{listing.title}</CardTitle>
                  {listing.allowsRiskSharing && (
                    <Badge className="bg-blue-100 text-blue-700">
                      <Shield className="w-3 h-3 mr-1" />
                      Risk Sharing
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Link
                    href={`/${encodeURIComponent(listing.chamaName.toLowerCase().replace(/\s+/g, "-"))}`}
                    className="text-sm text-gray-600 flex items-center gap-1 hover:text-[#083232] transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    {listing.chamaName}
                  </Link>
                  {listing.chamaReputation && (
                    <div className="flex items-center gap-1">
                      <ReputationBadge
                        tier={listing.chamaReputation.tier}
                        name=""
                        size="sm"
                        showLabel={false}
                      />
                      <span className="text-xs text-gray-500">
                        {listing.chamaReputation.totalScore}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                {listing.description && (
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {listing.description}
                  </p>
                )}

                {/* Loan Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Amount Range</p>
                      <p className="text-sm font-semibold text-gray-900">
                        Ksh {formatAmount(listing.minAmount)} -{" "}
                        {formatAmount(listing.maxAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Percent className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Interest Rate</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {listing.interestRateMin}% - {listing.interestRateMax}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Repayment Period</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {listing.minRepaymentPeriodMonths} -{" "}
                        {listing.maxRepaymentPeriodMonths} months
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Applications</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {listing.totalApplications}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {listing.requiresEmploymentVerification && (
                    <Badge variant="outline" className="text-xs">
                      Employment Required
                    </Badge>
                  )}
                  {listing.requiresIncomeProof && (
                    <Badge variant="outline" className="text-xs">
                      Income Proof Required
                    </Badge>
                  )}
                  {listing.minMonthlyIncome && (
                    <Badge variant="outline" className="text-xs">
                      Min Income: Ksh {formatAmount(listing.minMonthlyIncome)}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push(`/lending/listings/${listing.id}`)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  <Button
                    className="flex-1 bg-[#083232] hover:bg-[#2e856e]"
                    onClick={() => handleApply(listing)}
                  >
                    Apply Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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

