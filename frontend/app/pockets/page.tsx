"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import { useAuthGuard } from "@/hooks/use-auth";
import {
  MoreHorizontal,
  FileText,
  Plus,
  EyeOff,
  Wallet,
  Home,
  ShoppingBag,
  Plane,
  Utensils,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";

interface Pocket {
  id: string;
  name: string;
  balance: number;
  type: "main" | "savings" | "spending";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function PocketsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthGuard();
  const [activeTab, setActiveTab] = useState<"all" | "my" | "shared">("my");
  const [showBalance, setShowBalance] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        const response = await fetch(`${apiUrl}/wallet/balance`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setWalletBalance(data.balance || 0);
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
      }
    };

    if (isAuthenticated) {
      fetchWalletBalance();
    }
  }, [isAuthenticated]);

  // Sample pockets data
  const [pockets] = useState<Pocket[]>([
    {
      id: "1",
      name: "Main Pocket",
      balance: 0,
      type: "main",
      icon: Wallet,
      color: "bg-gray-50",
    },
    {
      id: "2",
      name: "Dream House",
      balance: 3000000,
      type: "savings",
      icon: Home,
      color: "bg-[#083232]",
    },
    {
      id: "3",
      name: "Shopping",
      balance: 3000000,
      type: "spending",
      icon: ShoppingBag,
      color: "bg-[#2e856e]",
    },
    {
      id: "4",
      name: "Traveling",
      balance: 2000000,
      type: "savings",
      icon: Plane,
      color: "bg-[#083232]",
    },
    {
      id: "5",
      name: "Food",
      balance: 2000000,
      type: "spending",
      icon: Utensils,
      color: "bg-[#2e856e]",
    },
  ]);

  // Calculate total balance with main pocket using wallet balance
  const totalBalance = pockets.reduce((sum, pocket) => {
    if (pocket.type === "main") {
      return sum + walletBalance;
    }
    return sum + pocket.balance;
  }, 0);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getPocketTypeLabel = (type: string) => {
    switch (type) {
      case "main":
        return "Main Pocket";
      case "savings":
        return "Savings Pocket";
      case "spending":
        return "Spending Pocket";
      default:
        return "";
    }
  };

  return (
    <>
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
      />
      <div className="min-h-screen bg-gradient-to-b from-gray-100 via-gray-50 to-white md:bg-gray-50 flex flex-col pt-14 md:pt-16 pb-20 md:pb-4">
        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-6 flex-1 w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900">
              Pockets
            </h1>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreHorizontal className="w-6 h-6 text-gray-900" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <FileText className="w-6 h-6 text-gray-900" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("my")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "my"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              My Pockets
            </button>
            <button
              onClick={() => setActiveTab("shared")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "shared"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Shared with me
            </button>
          </div>

          {/* Total Balance */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-900">
              My Balance
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xl md:text-2xl font-bold text-gray-900">
                {showBalance ? `Ksh ${formatAmount(totalBalance)}` : "••••••"}
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <EyeOff className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Pockets Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {pockets.map((pocket) => (
              <button
                key={pocket.id}
                onClick={() => router.push(`/pockets/${pocket.id}`)}
                className={`${pocket.color} ${
                  pocket.color.includes("50") ? "text-gray-900" : "text-white"
                } rounded-lg p-4 text-left hover:opacity-90 transition-opacity md:rounded-2xl aspect-square flex flex-col`}
              >
                {/* Top Half - Icon */}
                <div className="flex items-center justify-center h-1/2">
                  <pocket.icon
                    className={`w-12 h-12 md:w-20 md:h-20 ${
                      pocket.color.includes("50")
                        ? "text-gray-900"
                        : "text-white"
                    }`}
                  />
                </div>

                {/* Bottom Half - Text */}
                <div className="h-1/2 flex flex-col justify-center">
                  <h3 className="font-semibold text-sm md:text-base mb-0.5 line-clamp-1">
                    {pocket.name}
                  </h3>
                  <p className="font-bold text-sm md:text-base mb-0.5">
                    Ksh{" "}
                    {formatAmount(
                      pocket.type === "main" ? walletBalance : pocket.balance,
                    )}
                  </p>
                  <p
                    className={`text-xs ${
                      pocket.color.includes("50")
                        ? "text-gray-600"
                        : "text-white/80"
                    }`}
                  >
                    {getPocketTypeLabel(pocket.type)}
                  </p>
                </div>
              </button>
            ))}

            {/* Create Pocket Card */}
            <button
              onClick={() => router.push("/pockets/create")}
              className="bg-gray-50 text-gray-900 rounded-lg p-4 flex flex-col items-center justify-center hover:bg-gray-100 transition-colors md:rounded-2xl border-2 border-dashed border-gray-300 aspect-square"
            >
              <div className="w-12 h-12 bg-[#083232] rounded-full flex items-center justify-center mb-2">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-sm md:text-base">
                Create Pocket
              </span>
            </button>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
