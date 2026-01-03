"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Calendar,
  Percent,
  Clock,
  Award,
  PieChart,
  FileText,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface Investment {
  id: string;
  chama_id: string;
  product_id: string;
  product_name: string;
  product_type: string;
  amount: number;
  interest_rate: number;
  expected_return: number;
  investment_date: string;
  maturity_date: string;
  status: string;
  principal_returned: number;
  interest_earned: number;
  total_return: number;
  chama_name: string;
}

interface Dividend {
  id: string;
  amount: number;
  payment_date: string;
  period_start: string | null;
  period_end: string | null;
  status: string;
  recipient_chama_name: string | null;
  recipient_user_name: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  matured: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  liquidated: "bg-orange-100 text-orange-800",
};

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  treasury_bill_91: "91-Day Treasury Bill",
  treasury_bill_182: "182-Day Treasury Bill",
  treasury_bill_364: "364-Day Treasury Bill",
  money_market_fund: "Money Market Fund",
  government_bond: "Government Bond",
  fixed_deposit: "Fixed Deposit",
  investment_pool: "Investment Pool",
};

export default function InvestmentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const investmentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [dividends, setDividends] = useState<Dividend[]>([]);

  useEffect(() => {
    fetchInvestmentDetails();
    fetchDividends();
  }, [investmentId]);

  const fetchInvestmentDetails = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        apiUrl(`investment/investments/${investmentId}`),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInvestment(data);
      } else {
        throw new Error("Failed to fetch investment details");
      }
    } catch (error) {
      console.error("Failed to fetch investment:", error);
      toast({
        title: "Error",
        description: "Failed to load investment details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDividends = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await fetch(
        apiUrl(`investment/investments/${investmentId}/dividends`),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDividends(data);
      }
    } catch (error) {
      console.error("Failed to fetch dividends:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDaysUntilMaturity = (maturityDate: string) => {
    const today = new Date();
    const maturity = new Date(maturityDate);
    const diffTime = maturity.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const calculateROI = (invested: number, returns: number) => {
    if (invested === 0) return 0;
    return ((returns / invested) * 100).toFixed(2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232]"></div>
          <p className="mt-4 text-gray-600">Loading investment details...</p>
        </div>
      </div>
    );
  }

  if (!investment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-4">Investment not found</p>
            <Link href="/investment/marketplace">
              <Button variant="outline">Back to Marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const daysUntilMaturity = getDaysUntilMaturity(investment.maturity_date);
  const isMatured = daysUntilMaturity <= 0;
  const returnPercentage = calculateROI(investment.amount, investment.total_return);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#083232]">
                {investment.product_name}
              </h1>
              <p className="text-gray-600 mt-1">{investment.chama_name}</p>
            </div>
            <Badge className={STATUS_COLORS[investment.status] || "bg-gray-100"}>
              {investment.status.replace("_", " ")}
            </Badge>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Amount Invested
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#083232]" />
                <p className="text-2xl font-bold">{formatCurrency(investment.amount)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(investment.total_return)} ({returnPercentage}%)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {isMatured ? "Matured" : "Matures In"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#083232]" />
                <p className="text-2xl font-bold">
                  {isMatured
                    ? "Matured"
                    : `${daysUntilMaturity} day${daysUntilMaturity !== 1 ? "s" : ""}`}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Investment Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Investment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Product Type</p>
                <p className="font-semibold">
                  {PRODUCT_TYPE_LABELS[investment.product_type] || investment.product_type}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Interest Rate</p>
                <p className="font-semibold">{investment.interest_rate}% p.a.</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Investment Date</p>
                <p className="font-semibold">
                  {new Date(investment.investment_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Maturity Date</p>
                <p className="font-semibold">
                  {new Date(investment.maturity_date).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Returns Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Principal</p>
                <p className="font-semibold">{formatCurrency(investment.amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Interest Earned</p>
                <p className="font-semibold text-green-600">
                  {formatCurrency(investment.interest_earned)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Expected Return</p>
                <p className="font-semibold">
                  {formatCurrency(investment.expected_return)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Return</p>
                <p className="font-semibold text-green-600">
                  {formatCurrency(investment.total_return)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dividends History */}
        {dividends.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dividend History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dividends.map((dividend) => (
                  <div
                    key={dividend.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">
                        {formatCurrency(dividend.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Paid on {new Date(dividend.payment_date).toLocaleDateString()}
                      </p>
                      {dividend.period_start && dividend.period_end && (
                        <p className="text-xs text-gray-400">
                          Period: {new Date(dividend.period_start).toLocaleDateString()} - {new Date(dividend.period_end).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        dividend.status === "distributed"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {dividend.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Link href={`/${investment.chama_id}?tab=investments`}>
            <Button variant="outline">View Portfolio</Button>
          </Link>
          <Link href="/investment/marketplace">
            <Button className="bg-[#083232] hover:bg-[#2e856e]">
              Browse More Investments
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

