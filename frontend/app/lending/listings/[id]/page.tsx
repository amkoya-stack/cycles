"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Percent,
  Calendar,
  Users,
  Shield,
  CheckCircle,
  ArrowLeft,
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/hooks/use-auth";
import { ExternalLoanApplicationForm } from "@/components/lending/external-loan-application-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge as ReputationBadge } from "@/components/reputation/badge";
import Link from "next/link";

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
  minBorrowerReputationTier?: string | null;
  chamaReputation?: {
    tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
    totalScore: number;
  };
}

export default function ListingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const listingId = params.id as string;

  const [listing, setListing] = useState<ExternalLoanListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);

  useEffect(() => {
    fetchListingDetails();
  }, [listingId]);

  const fetchListingDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl(`lending/external/listings/${listingId}`));

      if (response.ok) {
        const data = await response.json();
        const listingData = data.data;

        // Fetch chama reputation
        try {
          const accessToken = localStorage.getItem("accessToken");
          const repResponse = await fetch(
            apiUrl(`reputation/${listingData.chamaId}/summary`),
            {
              headers: accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : {},
            }
          );

          if (repResponse.ok) {
            const repData = await repResponse.json();
            listingData.chamaReputation =
              repData.reputation || repData.data?.reputation;
          }
        } catch (err) {
          console.error("Failed to fetch reputation:", err);
        }

        setListing(listingData);
      } else {
        throw new Error("Failed to fetch listing");
      }
    } catch (error) {
      console.error("Failed to fetch listing:", error);
      toast({
        title: "Error",
        description: "Failed to load listing details",
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleApply = () => {
    if (!listing) return;

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      toast({
        title: "Authentication Required",
        description: "Please log in to apply for a loan",
        variant: "destructive",
      });
      router.push(`/auth/login?redirect=/lending/listings/${listingId}`);
      return;
    }

    setShowApplicationDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
          title="Loan Listing"
        />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading listing details...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeNavbar
          isAuthenticated={isAuthenticated}
          showSearchInNav={false}
          searchQuery=""
          onSearchChange={() => {}}
          title="Loan Listing"
        />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Listing Not Found
              </h3>
              <p className="text-gray-600 mb-6">
                The loan listing you're looking for doesn't exist or has been removed.
              </p>
              <Button
                onClick={() => router.push("/lending/marketplace")}
                className="bg-[#083232] hover:bg-[#2e856e]"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Marketplace
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
        title="Loan Listing"
      />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push("/lending/marketplace")}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">{listing.title}</CardTitle>
                      <div className="flex items-center gap-3">
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
                              {listing.chamaReputation.totalScore} points
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {listing.allowsRiskSharing && (
                      <Badge className="bg-blue-100 text-blue-700">
                        <Shield className="w-3 h-3 mr-1" />
                        Risk Sharing
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {listing.description && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                      <p className="text-gray-700 leading-relaxed">
                        {listing.description}
                      </p>
                    </div>
                  )}

                  {/* Key Details Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <DollarSign className="w-5 h-5 text-[#083232] mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Loan Amount Range</p>
                        <p className="text-lg font-bold text-gray-900">
                          Ksh {formatAmount(listing.minAmount)} -{" "}
                          {formatAmount(listing.maxAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <Percent className="w-5 h-5 text-[#083232] mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Interest Rate</p>
                        <p className="text-lg font-bold text-gray-900">
                          {listing.interestRateMin}% - {listing.interestRateMax}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-[#083232] mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Repayment Period</p>
                        <p className="text-lg font-bold text-gray-900">
                          {listing.minRepaymentPeriodMonths} -{" "}
                          {listing.maxRepaymentPeriodMonths} months
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-[#083232] mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Total Applications</p>
                        <p className="text-lg font-bold text-gray-900">
                          {listing.totalApplications}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Requirements */}
                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Requirements</h3>
                    <div className="space-y-2">
                      {listing.requiresEmploymentVerification && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Employment verification required
                        </div>
                      )}
                      {listing.requiresIncomeProof && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Income proof required
                        </div>
                      )}
                      {listing.minMonthlyIncome && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Minimum monthly income: Ksh{" "}
                          {formatAmount(listing.minMonthlyIncome)}
                        </div>
                      )}
                      {listing.minBorrowerReputationTier && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Minimum reputation tier:{" "}
                          {listing.minBorrowerReputationTier}
                        </div>
                      )}
                      {listing.allowsRiskSharing && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Risk sharing available (up to {listing.maxCoFunders} co-funders)
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Statistics Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Listing Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {listing.totalApplications}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Applications</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {listing.totalApproved}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Approved</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">
                        {listing.totalFunded}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Funded</p>
                    </div>
                  </div>
                  {listing.averageInterestRate && (
                    <div className="mt-4 pt-4 border-t text-center">
                      <p className="text-sm text-gray-600">Average Interest Rate</p>
                      <p className="text-xl font-bold text-gray-900">
                        {listing.averageInterestRate.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Apply Card */}
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Apply for This Loan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Ready to apply? Click the button below to start your application.
                    </p>
                    {listing.expiresAt && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        Expires: {formatDate(listing.expiresAt)}
                      </div>
                    )}
                  </div>
                  <Button
                    className="w-full bg-[#083232] hover:bg-[#2e856e]"
                    onClick={handleApply}
                    size="lg"
                  >
                    Apply Now
                  </Button>
                  <Link
                    href={`/${encodeURIComponent(listing.chamaName.toLowerCase().replace(/\s+/g, "-"))}`}
                    className="block"
                  >
                    <Button variant="outline" className="w-full">
                      View Chama Profile
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Listing Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Listing Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600">Created</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(listing.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Last Updated</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(listing.updatedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    <Badge
                      className={
                        listing.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }
                    >
                      {listing.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Application Dialog */}
      {listing && (
        <Dialog
          open={showApplicationDialog}
          onOpenChange={setShowApplicationDialog}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Apply for Loan</DialogTitle>
              <DialogDescription>
                Complete the form below to apply for a loan from{" "}
                {listing.chamaName}
              </DialogDescription>
            </DialogHeader>
            <ExternalLoanApplicationForm
              listing={listing}
              onSuccess={() => {
                setShowApplicationDialog(false);
                toast({
                  title: "Success",
                  description: "Loan application submitted successfully",
                });
              }}
              onCancel={() => setShowApplicationDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <Footer />
    </div>
  );
}

