"use client";

import { ExternalMarketplace } from "@/components/lending/external-marketplace";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/hooks/use-auth";

export default function MarketplacePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
        title="Loan Marketplace"
      />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ExternalMarketplace />
        </div>
      </main>

      <Footer />
    </div>
  );
}

