"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Calculator, FileText, User, Settings } from "lucide-react";

const DEMO_ROLES = [
  {
    id: "chairperson",
    label: "Chairperson",
    icon: Crown,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Full control over chama operations",
    permissions: [
      "Assign roles",
      "Remove members",
      "Manage settings",
      "All financial operations",
    ],
  },
  {
    id: "treasurer",
    label: "Treasurer",
    icon: Calculator,
    color: "bg-green-100 text-green-800 border-green-200",
    description: "Manages finances and transactions",
    permissions: [
      "View all transactions",
      "Process payouts",
      "Generate reports",
      "Manage contributions",
    ],
  },
  {
    id: "secretary",
    label: "Secretary",
    icon: FileText,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Handles documentation and communication",
    permissions: [
      "Send notifications",
      "Manage meetings",
      "Create reports",
      "Communication management",
    ],
  },
  {
    id: "member",
    label: "Member",
    icon: User,
    color: "bg-gray-100 text-gray-800 border-gray-200",
    description: "Regular member with basic permissions",
    permissions: [
      "Make contributions",
      "View own transactions",
      "Participate in meetings",
      "Request payouts",
    ],
  },
];

export default function RoleSystemDemo() {
  const [selectedRole, setSelectedRole] = useState<string>("member");

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-[#083232]">
            Chama Role System
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            The Cycle platform implements a four-tier role system for chamas.
            Each role has specific permissions and responsibilities within the
            group.
          </p>
        </div>

        {/* Role Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEMO_ROLES.map((role) => (
            <Card
              key={role.id}
              className={`p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedRole === role.id ? "ring-2 ring-[#083232]" : ""
              }`}
              onClick={() => setSelectedRole(role.id)}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 rounded-full bg-gray-100">
                  <role.icon className="w-8 h-8 text-[#083232]" />
                </div>
                <Badge variant="secondary" className={role.color}>
                  {role.label}
                </Badge>
                <p className="text-sm text-gray-600">{role.description}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Detailed Role Information */}
        <Card className="p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {(() => {
                const role = DEMO_ROLES.find((r) => r.id === selectedRole);
                if (!role) return null;
                return (
                  <>
                    <div className="p-4 rounded-full bg-gray-100">
                      <role.icon className="w-10 h-10 text-[#083232]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-[#083232]">
                        {role.label}
                      </h2>
                      <p className="text-gray-600">{role.description}</p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">
                Permissions & Responsibilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {DEMO_ROLES.find((r) => r.id === selectedRole)?.permissions.map(
                  (permission, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                    >
                      <div className="w-2 h-2 bg-[#2e856e] rounded-full"></div>
                      <span className="text-sm">{permission}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">
                How Role Assignment Works
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Only chairpersons can assign roles to other members</li>
                <li>• Role changes are logged for audit purposes</li>
                <li>• Members receive notifications when their role changes</li>
                <li>
                  • Role assignments include an optional reason for transparency
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Role Hierarchy */}
        <Card className="p-8">
          <h3 className="text-xl font-bold text-[#083232] mb-6">
            Role Hierarchy
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-purple-600" />
                <span className="font-semibold">Chairperson</span>
              </div>
              <span className="text-sm text-purple-600">Highest Authority</span>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-px h-8 bg-gray-300"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <Calculator className="w-6 h-6 text-green-600" />
                  <span className="font-semibold">Treasurer</span>
                </div>
                <span className="text-sm text-green-600">
                  Financial Authority
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <span className="font-semibold">Secretary</span>
                </div>
                <span className="text-sm text-blue-600">
                  Administrative Authority
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-px h-8 bg-gray-300"></div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6 text-gray-600" />
                <span className="font-semibold">Member</span>
              </div>
              <span className="text-sm text-gray-600">Basic Access</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
