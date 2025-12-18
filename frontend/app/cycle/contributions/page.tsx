"use client";

import { useState } from "react";
import { ContributionDashboard } from "@/components/chama/contribution-dashboard";
import { ContributeForm } from "@/components/chama/contribute-form";
import { ContributionHistory } from "@/components/chama/contribution-history";
import { AutoDebitForm } from "@/components/chama/auto-debit-form";
import { PenaltyManagement } from "@/components/chama/penalty-management";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Home, History, Calendar, AlertCircle, CreditCard } from "lucide-react";

interface ContributionPageProps {
  chamaId: string;
  cycleId: string;
  expectedAmount: number;
  contributionType?: "fixed" | "flexible" | "income_based";
  minAmount?: number;
  maxAmount?: number;
}

export default function ContributionPage({
  chamaId,
  cycleId,
  expectedAmount,
  contributionType = "fixed",
  minAmount,
  maxAmount,
}: ContributionPageProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [contributeDialogOpen, setContributeDialogOpen] = useState(false);
  const [autoDebitDialogOpen, setAutoDebitDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleContributeSuccess = () => {
    setContributeDialogOpen(false);
    setRefreshKey((k) => k + 1); // Refresh dashboard
  };

  const handleAutoDebitSuccess = () => {
    setAutoDebitDialogOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#083232]">Contributions</h1>
        <p className="text-gray-600 mt-1">
          Manage your monthly contributions and payments
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 gap-2 bg-transparent h-auto p-0">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-[#083232] data-[state=active]:text-white"
          >
            <Home className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-[#083232] data-[state=active]:text-white"
          >
            <History className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
          <TabsTrigger
            value="auto-debit"
            className="data-[state=active]:bg-[#083232] data-[state=active]:text-white"
          >
            <Calendar className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Auto-Debit</span>
          </TabsTrigger>
          <TabsTrigger
            value="penalties"
            className="data-[state=active]:bg-[#083232] data-[state=active]:text-white"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Penalties</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <ContributionDashboard
            key={refreshKey}
            cycleId={cycleId}
            onContributeClick={() => setContributeDialogOpen(true)}
          />

          {/* Quick Actions */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[#083232] mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setContributeDialogOpen(true)}
                className="flex items-center gap-3 p-4 border rounded-lg hover:border-[#083232] hover:bg-gray-50 transition-colors text-left"
              >
                <div className="p-3 bg-[#f64d52]/10 rounded-lg">
                  <CreditCard className="h-6 w-6 text-[#f64d52]" />
                </div>
                <div>
                  <p className="font-medium text-[#083232]">
                    Make Contribution
                  </p>
                  <p className="text-sm text-gray-600">
                    Pay your monthly contribution
                  </p>
                </div>
              </button>

              <button
                onClick={() => setAutoDebitDialogOpen(true)}
                className="flex items-center gap-3 p-4 border rounded-lg hover:border-[#083232] hover:bg-gray-50 transition-colors text-left"
              >
                <div className="p-3 bg-[#2e856e]/10 rounded-lg">
                  <Calendar className="h-6 w-6 text-[#2e856e]" />
                </div>
                <div>
                  <p className="font-medium text-[#083232]">Setup Auto-Debit</p>
                  <p className="text-sm text-gray-600">
                    Automate your contributions
                  </p>
                </div>
              </button>
            </div>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <ContributionHistory chamaId={chamaId} cycleId={cycleId} />
        </TabsContent>

        {/* Auto-Debit Tab */}
        <TabsContent value="auto-debit">
          <Card className="p-6">
            <AutoDebitForm
              chamaId={chamaId}
              cycleId={cycleId}
              expectedAmount={expectedAmount}
              onSuccess={handleAutoDebitSuccess}
              onCancel={() => setActiveTab("overview")}
            />
          </Card>
        </TabsContent>

        {/* Penalties Tab */}
        <TabsContent value="penalties">
          <PenaltyManagement chamaId={chamaId} />
        </TabsContent>
      </Tabs>

      {/* Contribute Dialog */}
      <Dialog
        open={contributeDialogOpen}
        onOpenChange={setContributeDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#083232]">
              Make Contribution
            </DialogTitle>
          </DialogHeader>
          <ContributeForm
            chamaId={chamaId}
            cycleId={cycleId}
            expectedAmount={expectedAmount}
            contributionType={contributionType}
            minAmount={minAmount}
            maxAmount={maxAmount}
            onSuccess={handleContributeSuccess}
            onCancel={() => setContributeDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Auto-Debit Dialog (mobile only) */}
      <Dialog open={autoDebitDialogOpen} onOpenChange={setAutoDebitDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto md:hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#083232]">
              Setup Auto-Debit
            </DialogTitle>
          </DialogHeader>
          <AutoDebitForm
            chamaId={chamaId}
            cycleId={cycleId}
            expectedAmount={expectedAmount}
            onSuccess={handleAutoDebitSuccess}
            onCancel={() => setAutoDebitDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
