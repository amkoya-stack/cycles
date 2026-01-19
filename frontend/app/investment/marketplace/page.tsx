"use client";

import { InvestmentMarketplace } from "@/components/investment/investment-marketplace";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";

export default function InvestmentMarketplacePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeNavbar
        isAuthenticated={true}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
        title="Investment Marketplace"
      />
      <div className="flex-1 pt-14 md:pt-16">
        <main className="max-w-7xl mx-auto px-4 py-8">
          <InvestmentMarketplace />
        </main>
      </div>
      <Footer />
    </div>
  );
}
