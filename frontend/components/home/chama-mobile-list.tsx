/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, TrendingUp, Lock, Globe } from "lucide-react";
import { formatAmount, formatFrequency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ChamaMobileListProps {
  loading: boolean;
  chamas: any[];
  onJoin: (chamaId: string) => void;
  onView: (chamaId: string) => void;
}

export function ChamaMobileList({
  loading,
  chamas,
  onJoin,
  onView,
}: ChamaMobileListProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#083232]"></div>
      </div>
    );
  }

  if (chamas.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-gray-600 text-base mb-4">No cycles found</p>
        <Link href="/cycle/create">
          <Button className="bg-[#083232] hover:bg-[#2e856e] text-white">
            Create Your First Cycle
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {chamas.map((chama) => {
        const slug = chama.name.toLowerCase().replace(/\s+/g, "-");
        
        return (
          <div
            key={chama.id}
            className="bg-white border-b border-gray-200 active:bg-gray-50 transition-colors"
            onClick={() => {
              router.push(`/${encodeURIComponent(slug)}`);
            }}
          >
            <div className="px-4 py-3 flex gap-3">
              {/* Chama Icon/Image - Compact */}
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#083232] flex items-center justify-center">
                  {chama.cover_image ? (
                    <Image
                      src={chama.cover_image}
                      alt={chama.name}
                      width={56}
                      height={56}
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-white text-2xl">
                      {chama.icon || "🟢"}
                    </span>
                  )}
                </div>
              </div>

              {/* Content - Takes remaining space */}
              <div className="flex-1 min-w-0">
                {/* Chama Name */}
                <h3 className="font-semibold text-base text-[#083232] mb-1 line-clamp-1">
                  {chama.name}
                </h3>

                {/* Quick Stats - Compact */}
                <div className="flex items-center gap-3 text-xs text-gray-600 mb-1.5">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{chama.members_count || chama.active_members || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>KSh {formatAmount(chama.contribution_amount)}</span>
                    <span className="text-gray-400">/</span>
                    <span>{formatFrequency(chama.contribution_frequency)}</span>
                  </div>
                </div>

                {/* Tags - Compact badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {chama.is_public !== false ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      <Globe className="w-3 h-3" />
                      <span>Public</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                      <Lock className="w-3 h-3" />
                      <span>Private</span>
                    </div>
                  )}
                  
                  {(chama.lending_enabled || chama.settings?.lending_enabled) && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                      <TrendingUp className="w-3 h-3" />
                      <span>Lending</span>
                    </div>
                  )}

                  {chama.role && (
                    <div className="px-2 py-0.5 bg-[#083232] text-white rounded text-xs font-medium">
                      Member
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

