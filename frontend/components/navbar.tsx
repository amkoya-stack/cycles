"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, User, Wallet } from "lucide-react";

interface NavbarProps {
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export function Navbar({ showSearch, searchValue, onSearchChange }: NavbarProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 bg-[#083232] text-white z-50 shadow-md">
      <div className="max-w-[1085px] mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
            <span className="text-xl font-bold">Cycles</span>
          </Link>

          {/* Search Bar (shown when scrolled) */}
          {showSearch && (
            <div className="flex-1 max-w-[500px] transition-all duration-300">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="search by cycle name"
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}

          {!showSearch && <div className="flex-1"></div>}

          {/* Right Actions */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            <button className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#f64d52] rounded-full"></span>
            </button>
            <Link
              href="/wallet"
              className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors"
            >
              <Wallet className="w-5 h-5" />
            </Link>
            <Link
              href="/profile"
              className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors"
            >
              <User className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
