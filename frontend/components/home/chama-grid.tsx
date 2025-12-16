/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Plus } from "lucide-react";
import { ChamaCard } from "@/components/chama/chama-card";
import { Button } from "@/components/ui/button";

interface ChamaGridProps {
  loading: boolean;
  chamas: any[];
  onJoin: (chamaId: string) => void;
  onView: (chamaId: string) => void;
}

export function ChamaGrid({ loading, chamas, onJoin, onView }: ChamaGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
      </div>
    );
  }

  if (chamas.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600 text-lg mb-4">No cycles found</p>
        <Link href="/cycle/create">
          <Button className="bg-[#083232] hover:bg-[#2e856e] text-white cursor-pointer">
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Cycle
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1059px]">
        {chamas.map((chama) => (
          <ChamaCard
            key={chama.id}
            chama={chama}
            onJoin={onJoin}
            onView={onView}
          />
        ))}
      </div>
    </div>
  );
}
