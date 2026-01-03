"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  TrendingUp,
  Shield,
  Filter,
  X,
  Clock,
  Award,
  Building2,
  ArrowRight,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { InvestmentProposalForm } from "./investment-proposal-form";

interface InvestmentProduct {
  id: string;
  product_type: string;
  name: string;
  description: string | null;
  minimum_investment: number;
  maximum_investment: number | null;
  interest_rate: number;
  risk_rating: number;
  maturity_days: number;
  compounding_frequency: string;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  treasury_bill_91: "91-Day Treasury Bill",
  treasury_bill_182: "182-Day Treasury Bill",
  treasury_bill_364: "364-Day Treasury Bill",
  money_market_fund: "Money Market Fund",
  government_bond: "Government Bond",
  fixed_deposit: "Fixed Deposit",
  investment_pool: "Investment Pool",
};

const RISK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Very Low", color: "bg-green-100 text-green-800" },
  2: { label: "Low", color: "bg-blue-100 text-blue-800" },
  3: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  4: { label: "High", color: "bg-orange-100 text-orange-800" },
  5: { label: "Very High", color: "bg-red-100 text-red-800" },
};

export function InvestmentMarketplace() {
  const { toast } = useToast();
  const [products, setProducts] = useState<InvestmentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<InvestmentProduct | null>(null);
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [productType, setProductType] = useState<string>("all");
  const [minInterestRate, setMinInterestRate] = useState<string>("");
  const [maxRiskRating, setMaxRiskRating] = useState<string>("");
  const [minInvestment, setMinInvestment] = useState<string>("");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [productType, minInterestRate, maxRiskRating, showFeaturedOnly]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const params = new URLSearchParams();
      params.append("isActive", "true");
      if (productType !== "all") params.append("productType", productType);
      if (minInterestRate) params.append("minInterestRate", minInterestRate);
      if (maxRiskRating) params.append("maxRiskRating", maxRiskRating);
      if (showFeaturedOnly) params.append("isFeatured", "true");

      const response = await fetch(
        `${apiUrl("investment/products")}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      } else {
        throw new Error("Failed to fetch products");
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast({
        title: "Error",
        description: "Failed to load investment products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !product.name.toLowerCase().includes(query) &&
          !product.description?.toLowerCase().includes(query) &&
          !PRODUCT_TYPE_LABELS[product.product_type]?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      if (minInvestment) {
        const min = parseFloat(minInvestment);
        if (product.minimum_investment > min) return false;
      }

      return true;
    });
  }, [products, searchQuery, minInvestment]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMaturity = (days: number) => {
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  };

  const handleInvest = (product: InvestmentProduct) => {
    setSelectedProduct(product);
    setShowProposalDialog(true);
  };

  const handleProposalSuccess = () => {
    setShowProposalDialog(false);
    setSelectedProduct(null);
    toast({
      title: "Success",
      description: "Investment proposal created successfully",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#083232]">Investment Marketplace</h1>
          <p className="text-gray-600 mt-1">
            Browse and invest in various investment products
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Filters */}
      {(showFilters || searchQuery || productType !== "all" || minInterestRate || maxRiskRating || minInvestment || showFeaturedOnly) && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Product Type */}
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="Product Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Min Interest Rate */}
              <Input
                type="number"
                placeholder="Min Interest Rate %"
                value={minInterestRate}
                onChange={(e) => setMinInterestRate(e.target.value)}
              />

              {/* Max Risk Rating */}
              <Select value={maxRiskRating} onValueChange={setMaxRiskRating}>
                <SelectTrigger>
                  <SelectValue placeholder="Max Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any Risk</SelectItem>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {RISK_LABELS[rating].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Min Investment */}
              <Input
                type="number"
                placeholder="Min Investment (KES)"
                value={minInvestment}
                onChange={(e) => setMinInvestment(e.target.value)}
              />

              {/* Featured Only */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="featured"
                  checked={showFeaturedOnly}
                  onChange={(e) => setShowFeaturedOnly(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="featured" className="text-sm text-gray-700">
                  Featured only
                </label>
              </div>

              {/* Clear Filters */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setProductType("all");
                  setMinInterestRate("");
                  setMaxRiskRating("");
                  setMinInvestment("");
                  setShowFeaturedOnly(false);
                }}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#083232]"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">No investment products found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={`hover:shadow-lg transition-shadow ${
                product.is_featured ? "border-[#083232] border-2" : ""
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      {product.is_featured && (
                        <Badge className="bg-[#083232] text-white">
                          <Award className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {PRODUCT_TYPE_LABELS[product.product_type] || product.product_type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                {product.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-[#083232]" />
                    <div>
                      <p className="text-xs text-gray-500">Interest Rate</p>
                      <p className="font-semibold">{product.interest_rate}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#083232]" />
                    <div>
                      <p className="text-xs text-gray-500">Risk Rating</p>
                      <Badge className={RISK_LABELS[product.risk_rating]?.color || "bg-gray-100"}>
                        {RISK_LABELS[product.risk_rating]?.label || product.risk_rating}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#083232]" />
                    <div>
                      <p className="text-xs text-gray-500">Min Investment</p>
                      <p className="font-semibold">{formatCurrency(product.minimum_investment)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#083232]" />
                    <div>
                      <p className="text-xs text-gray-500">Maturity</p>
                      <p className="font-semibold">{formatMaturity(product.maturity_days)}</p>
                    </div>
                  </div>
                </div>

                {/* Max Investment */}
                {product.maximum_investment && (
                  <div className="text-xs text-gray-500">
                    Max: {formatCurrency(product.maximum_investment)}
                  </div>
                )}

                {/* Action Button */}
                <Button
                  onClick={() => handleInvest(product)}
                  className="w-full bg-[#083232] hover:bg-[#2e856e]"
                >
                  Invest Now
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Investment Proposal Dialog */}
      <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Investment Proposal</DialogTitle>
            <DialogDescription>
              Create a proposal to invest in {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <InvestmentProposalForm
              product={selectedProduct}
              onSuccess={handleProposalSuccess}
              onCancel={() => {
                setShowProposalDialog(false);
                setSelectedProduct(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

