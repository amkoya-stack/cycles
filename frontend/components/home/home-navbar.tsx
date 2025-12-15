"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Wallet,
  User,
  ChevronDown,
  LogOut,
  Settings,
} from "lucide-react";

interface HomeNavbarProps {
  isAuthenticated: boolean;
  showSearchInNav: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  title?: string;
}

export function HomeNavbar({
  isAuthenticated,
  showSearchInNav,
  searchQuery,
  onSearchChange,
  title,
}: HomeNavbarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [userChamas, setUserChamas] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUserChamas = async () => {
      if (!isAuthenticated) return;

      try {
        const accessToken = localStorage.getItem("accessToken");
        const response = await fetch("http://localhost:3001/api/chama", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUserChamas(data);
        }
      } catch (error) {
        console.error("Error fetching user chamas:", error);
      }
    };

    if (isAuthenticated) {
      fetchUserChamas();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    window.location.href = "/";
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <nav className="bg-[#083232] text-white shadow-md">
        <div className="max-w-[1085px] mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link
              href="/"
              className="flex items-center space-x-2 flex-shrink-0"
            >
              <span className="text-xl font-bold">{title || "Cycles"}</span>
            </Link>

            {showSearchInNav && (
              <div className="flex-1 max-w-[500px] relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
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

            {!showSearchInNav && <div className="flex-1"></div>}

            <div className="flex items-center space-x-4 flex-shrink-0">
              {isAuthenticated ? (
                <>
                  <button className="p-2 hover:bg-white/10 rounded-lg transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#f64d52] rounded-full"></span>
                  </button>
                  <Link
                    href="/wallet"
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Wallet className="w-5 h-5" />
                  </Link>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-1 p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <User className="w-5 h-5" />
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showDropdown && (
                      <div className="absolute left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 text-gray-900">
                        {/* My Cycles Section */}
                        {userChamas.length > 0 && (
                          <>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                              My Cycles
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              {userChamas.map((chama) => {
                                const slug = chama.name
                                  .toLowerCase()
                                  .replace(/\s+/g, "-");
                                return (
                                  <Link
                                    key={chama.id}
                                    href={`/${encodeURIComponent(slug)}`}
                                    onClick={() => setShowDropdown(false)}
                                    className="block px-4 py-2 hover:bg-gray-50 transition-colors"
                                  >
                                    <span className="font-medium text-sm truncate">
                                      {chama.name}
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                            <div className="border-t border-gray-200 my-2"></div>
                          </>
                        )}

                        {/* Menu Items */}
                        <Link
                          href="/wallet"
                          onClick={() => setShowDropdown(false)}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                        >
                          <Wallet className="w-4 h-4" />
                          <span className="text-sm">My Wallet</span>
                        </Link>
                        <Link
                          href="/profile"
                          onClick={() => setShowDropdown(false)}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          <span className="text-sm">Profile</span>
                        </Link>
                        <Link
                          href="/settings"
                          onClick={() => setShowDropdown(false)}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          <span className="text-sm">Settings</span>
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left text-red-600"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm">Logout</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="px-4 py-2 hover:bg-white/10 text-white rounded-lg transition-colors font-medium"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
