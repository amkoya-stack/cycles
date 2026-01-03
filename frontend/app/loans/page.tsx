"use client";

import React from "react";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/hooks/use-auth";
import { MyLoans } from "@/components/lending/my-loans";
import { LoanPaymentReminders } from "@/components/lending/loan-payment-reminders";

export default function MyLoansPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={false}
        searchQuery=""
        onSearchChange={() => {}}
        title="My Loans"
      />
      <main className="flex-1">
        <div className="mx-auto px-4 py-8" style={{ maxWidth: '1085px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MyLoans />
            </div>
            <div className="lg:col-span-1">
              <LoanPaymentReminders limit={10} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

