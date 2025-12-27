import React from "react";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";
import {
  Bell,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Users,
  DollarSign,
  Wallet,
  Filter,
  Plus,
  MoreHorizontal,
  Percent,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// This component will be used in the chama Loans tab
export default function LoanDashboard() {
  const [activeTab, setActiveTab] = React.useState("Overview");

  const stats = [
    {
      title: "Total Portfolio",
      value: "$1.25M",
      change: "+12.5%",
      icon: DollarSign,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      positive: true,
    },
    {
      title: "Active & Overdue Loans",
      value: null, // We'll render custom content for this card
      change: null,
      icon: null,
      iconBg: "",
      iconColor: "",
      positive: null,
      custom: true,
      activeLoans: {
        value: "45",
        change: "+5",
      },
      overduePayments: {
        value: "3",
        change: "-2",
      },
    },
  ];

  const loans = [
    {
      id: "L001",
      status: "Active",
      borrower: "John Smith",
      progress: 30,
      remaining: "$35,000",
      total: "$50,000",
      interestRate: "8.5%",
      monthlyPayment: "$2,150",
      nextPayment: "Jul 15, 2024",
    },
    {
      id: "L002",
      status: "Overdue",
      borrower: "Sarah Johnson",
      progress: 13.3,
      remaining: "$43,350",
      total: "$50,000",
      interestRate: "9.0%",
      monthlyPayment: "$2,300",
      nextPayment: "Jun 28, 2024",
    },
  ];

  const activities = [
    {
      type: "payment",
      title: "Payment received from John Smith",
      amount: "$2,150",
      time: "2 hours ago",
      icon: DollarSign,
      bg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      type: "overdue",
      title: "Payment overdue from Sarah Johnson",
      amount: "$3,200",
      time: "1 day ago",
      icon: AlertCircle,
      bg: "bg-red-50",
      iconColor: "text-red-600",
    },
    {
      type: "application",
      title: "New loan application approved",
      amount: "$65,000",
      time: "3 days ago",
      icon: TrendingUp,
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Stats Grid - 3 cards in a row, wrapped in a parent Card */}
        <div className="grid grid-cols-20 gap-4 mb-6 items-stretch">
          {/* Total Portfolio Card (55% width) */}
          <Card className="h-full min-h-[280px] flex flex-col col-span-11">
            <CardContent className="p-0 flex-1 flex flex-col justify-between">
              <div className="bg-[#083232] rounded-t-xl p-6 flex flex-col gap-2 shadow-sm border-b border-gray-100">
                <div
                  className="flex items-center gap-2 rounded-t-lg w-full"
                  style={{ background: "#083232", padding: "1rem", margin: 0 }}
                >
                  <Wallet className="w-6 h-6 text-white" />
                  <span className="text-lg font-semibold text-white">
                    Total Cash
                  </span>
                </div>
                <p className="text-4xl font-extrabold text-white mt-2 mb-1">
                  Ksh 1,250,000
                </p>
                <span className="inline-block text-xs text-green-100 bg-green-600/70 px-3 py-1 rounded-full w-fit font-semibold">
                  +12.5% from last month
                </span>
              </div>
              <div className="flex-1 flex flex-col md:flex-row gap-0 md:gap-0 bg-white rounded-b-xl shadow-inner border-t border-gray-100">
                <div className="flex-1 flex flex-col items-center justify-center p-5 border-b md:border-b-0 md:border-r border-gray-100">
                  <div className="w-10 h-10 bg-[#2e856e]/10 rounded-full flex items-center justify-center mb-2">
                    <DollarSign className="w-5 h-5 text-[#2e856e]" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium mb-1">
                    Contributions
                  </p>
                  <p className="text-lg font-bold text-[#083232]">
                    Ksh 1,000,000
                  </p>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-5">
                  <div className="w-10 h-10 bg-[#f64d52]/10 rounded-full flex items-center justify-center mb-2">
                    <Percent className="w-5 h-5 text-[#f64d52]" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium mb-1">
                    Interest Income
                  </p>
                  <p className="text-lg font-bold text-[#083232]">
                    Ksh 250,000
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Active & Overdue Loans Card */}
          {/* Loans Pie Chart Card (45% width) */}
          <Card className="h-full min-h-[280px] flex flex-col col-span-9">
            <CardContent className="p-6 flex-1 flex flex-col items-center justify-center">
              <p className="text-base font-semibold text-gray-900 mb-4">
                Loan Distribution
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Active", value: 45 },
                      { name: "Overdue", value: 3 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    fill="#083232"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell key="active" fill="#2e856e" />
                    <Cell key="overdue" fill="#f64d52" />
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-[#2e856e]"></span>
                  <span className="text-xs text-gray-700">Active: 45</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-[#f64d52]"></span>
                  <span className="text-xs text-gray-700">Overdue: 3</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs and Buttons */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("Overview")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Overview"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("Loans")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Loans"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Loans
            </button>
            <button
              onClick={() => setActiveTab("Payments")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Payments"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Payments
            </button>
            <button
              onClick={() => setActiveTab("Analytics")}
              className={`text-sm font-semibold pb-2 transition-colors ${
                activeTab === "Analytics"
                  ? "text-gray-900 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Analytics
            </button>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Loan
            </Button>
          </div>
        </div>

        {/* Main Content Grid - Active Loans (wider) and Recent Activity (narrower) side by side */}
        <div className="grid grid-cols-12 gap-6">
          {/* Active Loans - Takes up 8 columns (wider) */}
          <div className="col-span-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Active & Overdue Loans
                </h2>
                <button className="text-sm text-blue-600 hover:text-blue-700">
                  View All
                </button>
              </div>

              <div className="space-y-4">
                {loans.map((loan) => (
                  <Card
                    key={loan.id}
                    className="border-l-4"
                    style={{
                      borderLeftColor:
                        loan.status === "Active" ? "#3b82f6" : "#ef4444",
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-gray-900">
                            {loan.id}
                          </span>
                          <Badge
                            variant={
                              loan.status === "Active"
                                ? "default"
                                : "destructive"
                            }
                            className={
                              loan.status === "Active"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : ""
                            }
                          >
                            {loan.status}
                          </Badge>
                        </div>
                        <button>
                          <MoreHorizontal className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-4 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{loan.borrower}</span>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-gray-600">Loan Progress</span>
                          <span className="font-medium text-gray-900">
                            {loan.progress}% paid
                          </span>
                        </div>
                        <Progress value={loan.progress} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between text-sm mb-4">
                        <span className="text-gray-600">
                          Remaining:{" "}
                          <span className="font-semibold text-gray-900">
                            {loan.remaining}
                          </span>
                        </span>
                        <span className="text-gray-600">
                          Total:{" "}
                          <span className="font-semibold text-gray-900">
                            {loan.total}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                        <div className="flex items-start gap-2">
                          <Percent className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">
                              Interest Rate
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {loan.interestRate}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">
                              Monthly Payment
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {loan.monthlyPayment}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">
                              Next Payment
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {loan.nextPayment}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity - Takes up 4 columns (narrower) */}
          <div className="col-span-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Recent Activity
              </h2>

              <div className="space-y-3">
                {activities.map((activity, index) => (
                  <div
                    key={index}
                    className={`${activity.bg} rounded-lg p-4 border border-gray-100`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 ${activity.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
                      >
                        <activity.icon
                          className={`w-5 h-5 ${activity.iconColor}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {activity.title}
                        </p>
                        <p className="text-lg font-semibold text-gray-900 mb-1">
                          {activity.amount}
                        </p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full mt-6 text-sm text-blue-600 hover:text-blue-700 font-medium">
                View All Activity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
