"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ChamaSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function ChamaSearch({ value, onChange }: ChamaSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <Input
        type="text"
        placeholder="search by cycle name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 h-12 text-base"
      />
    </div>
  );
}
