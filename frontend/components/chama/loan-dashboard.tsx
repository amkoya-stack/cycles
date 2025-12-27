import React from "react";
import {
  Bell,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Users,
  DollarSign,
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
      title: "Active Loans",
      value: "45",
      change: "+5",
      icon: TrendingUp,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      positive: true,
    },
    {
      title: "Overdue Payments",
      value: "3",
      change: "-2",
      icon: AlertCircle,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      positive: false,
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
        {/* Stats Grid - 3 cards in a row */}
        <div className="flex gap-4 mb-6">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className={
                index === 0
                  ? "flex-1 basis-0 min-w-0"
                  : "flex-[0.8] basis-0 min-w-0"
              }
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">{stat.title}</p>
                    <p className="text-3xl font-semibold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`w-12 h-12 ${stat.iconBg} rounded-full flex items-center justify-center`}
                  >
                    <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                </div>
                <span
                  className={`text-sm ${
                    stat.positive
                      ? "text-green-600 bg-green-50"
                      : "text-red-600 bg-red-50"
                  } px-2 py-1 rounded`}
                >
                  {stat.change}
                </span>
              </CardContent>
            </Card>
          ))}
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
                  Active Loans
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
