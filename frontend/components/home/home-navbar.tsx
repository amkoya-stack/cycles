"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Wallet,
  User,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  Settings,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

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
  const [showCyclesDropdown, setShowCyclesDropdown] = useState(false);
  const [userChamas, setUserChamas] = useState<any[]>([]);
  const [userName, setUserName] = useState<string>("Loading...");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cyclesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
      if (
        cyclesDropdownRef.current &&
        !cyclesDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCyclesDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!isAuthenticated) return;

      try {
        const accessToken = localStorage.getItem("accessToken");

        // Fetch user profile
        const profileResponse = await fetch(
          "http://localhost:3001/api/auth/profile",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (profileResponse.status === 401) {
          // Token expired or invalid, clear auth state
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.reload();
          return;
        }

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setUserName(profileData.full_name || profileData.email || "Account");
        }

        // Fetch user chamas
        const chamaResponse = await fetch("http://localhost:3001/api/chama", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (chamaResponse.ok) {
          const chamaData = await chamaResponse.json();
          setUserChamas(chamaData);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    if (isAuthenticated) {
      fetchUserData();
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
            <div className="relative" ref={cyclesDropdownRef}>
              <button
                onClick={() => setShowCyclesDropdown(!showCyclesDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 border border-white/20 cursor-pointer"
              >
                <span className="text-xl font-bold">{title || "Cycles"}</span>
                <ChevronsUpDown className="w-5 h-5" />
              </button>

              {showCyclesDropdown && (
                <div className="absolute left-0 mt-3 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden text-gray-900 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2">
                    <Link
                      href="/"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-all text-gray-700 group"
                      onClick={() => setShowCyclesDropdown(false)}
                    >
                      <div className="w-9 h-9 bg-[#083232]/10 rounded-lg flex items-center justify-center group-hover:bg-[#083232]/20 transition-colors">
                        <svg
                          className="w-5 h-5 text-[#083232]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium">
                        View All Cycles
                      </span>
                    </Link>
                    <Link
                      href="/cycle/create"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-all text-gray-700 group"
                      onClick={() => setShowCyclesDropdown(false)}
                    >
                      <div className="w-9 h-9 bg-[#f64d52]/10 rounded-lg flex items-center justify-center group-hover:bg-[#f64d52]/20 transition-colors">
                        <svg
                          className="w-5 h-5 text-[#f64d52]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium">
                        Create a Cycle
                      </span>
                    </Link>
                  </div>

                  {isAuthenticated && userChamas.length > 0 && (
                    <>
                      <div className="border-t border-gray-100"></div>
                      <div className="px-4 py-3 bg-gray-50/50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          My Cycles ({userChamas.length})
                        </p>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2">
                        {userChamas.map((chama) => {
                          const slug = chama.name
                            .toLowerCase()
                            .replace(/\s+/g, "-");
                          return (
                            <Link
                              key={chama.id}
                              href={`/${encodeURIComponent(slug)}`}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-all group"
                              onClick={() => setShowCyclesDropdown(false)}
                            >
                              <div className="w-10 h-10 bg-gradient-to-br from-[#083232] to-[#2e856e] rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                {chama.settings?.icon || "🟢"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#083232] transition-colors">
                                  {chama.name}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                    />
                                  </svg>
                                  {chama.active_members || 0} members
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

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
                  <div className="text-white">
                    <NotificationBell />
                  </div>
                  <Link
                    href="/wallet"
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Wallet className="w-5 h-5" />
                  </Link>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-1 p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <User className="w-5 h-5" />
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showDropdown && (
                      <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden text-gray-900">
                        {/* User Info */}
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {userName}
                          </p>
                        </div>

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
