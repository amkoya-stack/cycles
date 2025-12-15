/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatAmount, formatFrequency } from "@/lib/utils";

interface ChamaCardProps {
  chama: {
    id: string;
    name: string;
    description?: string;
    cover_image?: string;
    icon?: string;
    is_public?: boolean;
    lending_enabled?: boolean;
    members_count?: number;
    active_members?: number;
    contribution_amount: number;
    contribution_frequency: string;
    roi?: number;
    default_rate?: string;
    role?: string;
    settings?: any;
  };
  onJoin?: (chamaId: string) => void;
  onView?: (chamaId: string) => void;
}

export function ChamaCard({ chama, onJoin, onView }: ChamaCardProps) {
  return (
    <Card className="w-[337px] h-[382px] hover:shadow-lg transition-shadow flex flex-col p-0">
      {/* Cover Image */}
      <div className="relative w-full h-32 bg-gray-200 flex-shrink-0 overflow-hidden rounded-t-lg">
        {chama.cover_image ? (
          <Image
            src={chama.cover_image}
            alt={chama.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[#083232] flex items-center justify-center text-white text-4xl">
            {chama.icon || "🟢"}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0">
          <span className="text-xl">{chama.icon || "🟢"}</span>
        </div>

        {/* Chama Name */}
        <h3 className="font-semibold text-sm text-[#083232] line-clamp-1 flex-shrink-0">
          {chama.name}
        </h3>

        {/* Stats Line 1 */}
        <p className="text-xs text-gray-600 flex-shrink-0">
          {formatAmount(chama.members_count || chama.active_members || 0)}{" "}
          Members · KSh {formatAmount(chama.contribution_amount)}/
          {formatFrequency(chama.contribution_frequency)} ·{" "}
          {chama.is_public !== false ? "Public" : "Private"}
          {(chama.lending_enabled || chama.settings?.lending_enabled) &&
            " · Lending"}
        </p>

        {/* Stats Line 2 */}
        {chama.default_rate && (
          <p className="text-xs text-gray-600 flex-shrink-0">
            Default rate: {chama.default_rate}
          </p>
        )}

        {/* Description */}
        <p className="text-xs text-gray-600 line-clamp-2 flex-shrink-0">
          {chama.description}
        </p>

        {/* Action Button */}
        <Button
          className="w-full bg-[#083232] hover:bg-[#2e856e] text-white mt-auto"
          onClick={(e) => {
            e.preventDefault();
            if (chama.role) {
              // User is a member, view the chama
              const slug = chama.name.toLowerCase().replace(/\s+/g, "-");
              window.location.href = `/${encodeURIComponent(slug)}`;
            } else {
              // Not a member, allow joining
              onJoin?.(chama.id);
            }
          }}
        >
          {chama.role ? "View Cycle" : "Join this Cycle"}
        </Button>
      </div>
    </Card>
  );
}
