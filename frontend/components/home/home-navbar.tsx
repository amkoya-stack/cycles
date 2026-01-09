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
  DollarSign,
  MoreHorizontal,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationsDropdown } from "@/components/wallet/NotificationsDropdown";
import { apiUrl } from "@/lib/api-config";

interface HomeNavbarProps {
  isAuthenticated: boolean;
  showSearchInNav: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  title?: string;
  isChamaPage?: boolean;
  isAdmin?: boolean;
  isMember?: boolean;
  onSettingsClick?: () => void;
  onActivityClick?: () => void;
}

export function HomeNavbar({
  isAuthenticated,
  showSearchInNav,
  searchQuery,
  onSearchChange,
  title,
  isChamaPage = false,
  isAdmin = false,
  isMember = false,
  onSettingsClick,
  onActivityClick,
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
          apiUrl("auth/profile"),
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
          // Use full_name if available and not empty, otherwise fallback to email
          // Check both full_name and fullName (in case of camelCase)
          const fullName = (profileData.full_name || profileData.fullName || "").trim();
          if (fullName && fullName.length > 0) {
            setUserName(fullName);
          } else if (profileData.email) {
            // If no full_name, use email but try to extract name from email
            const emailName = profileData.email.split("@")[0];
            // Convert james.mutiso@gmail.com to "James Mutiso"
            const formattedName = emailName
              .split(".")
              .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" ");
            setUserName(formattedName);
          } else {
            setUserName("Account");
          }
        } else {
          // If profile fetch fails, set a default to prevent loading state
          setUserName("Account");
        }

        // Fetch user chamas
        const chamaResponse = await fetch(apiUrl("chama"), {
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
        // Set default to prevent loading state
        setUserName("Account");
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
          <div className="flex items-center justify-between h-14 md:h-16 gap-2 md:gap-4">
            <div className="relative" ref={cyclesDropdownRef}>
              <button
                onClick={() => setShowCyclesDropdown(!showCyclesDropdown)}
                className="flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 border border-white/20 cursor-pointer"
              >
                <span className="text-base md:text-xl font-bold">{title || "Cycles"}</span>
                <ChevronsUpDown className="w-4 h-4 md:w-5 md:h-5" />
              </button>

              {showCyclesDropdown && (
                <div className="absolute left-0 mt-3 w-56 md:w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden text-gray-900 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2">
                    <Link
                      href="/"
                      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-gray-50 transition-all text-gray-700 group"
                      onClick={() => setShowCyclesDropdown(false)}
                    >
                      <div className="w-8 h-8 md:w-9 md:h-9 bg-[#083232]/10 rounded-lg flex items-center justify-center group-hover:bg-[#083232]/20 transition-colors">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-[#083232]"
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
                      <span className="text-xs md:text-sm font-medium">
                        View All Cycles
                      </span>
                    </Link>
                    <Link
                      href="/cycle/create"
                      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-gray-50 transition-all text-gray-700 group"
                      onClick={() => setShowCyclesDropdown(false)}
                    >
                      <div className="w-8 h-8 md:w-9 md:h-9 bg-[#f64d52]/10 rounded-lg flex items-center justify-center group-hover:bg-[#f64d52]/20 transition-colors">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-[#f64d52]"
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
                      <span className="text-xs md:text-sm font-medium">
                        Create a Cycle
                      </span>
                    </Link>
                    <Link
                      href="/lending/marketplace"
                      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-gray-50 transition-all text-gray-700 group"
                      onClick={() => setShowCyclesDropdown(false)}
                    >
                      <div className="w-8 h-8 md:w-9 md:h-9 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-xs md:text-sm font-medium">
                        Loan Marketplace
                      </span>
                    </Link>
                    <Link
                      href="/investment/marketplace"
                      className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-gray-50 transition-all text-gray-700 group"
                      onClick={() => setShowCyclesDropdown(false)}
                    >
                      <div className="w-8 h-8 md:w-9 md:h-9 bg-green-500/10 rounded-lg flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                        <svg
                          className="w-4 h-4 md:w-5 md:h-5 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <span className="text-xs md:text-sm font-medium">
                        Investment Marketplace
                      </span>
                    </Link>
                  </div>

                  {isAuthenticated && userChamas.length > 0 && (
                    <>
                      <div className="border-t border-gray-100"></div>
                      <div className="px-3 md:px-4 py-2 md:py-3 bg-gray-50/50">
                        <p className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                              className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-lg hover:bg-gray-50 transition-all group"
                              onClick={() => setShowCyclesDropdown(false)}
                            >
                              {chama.cover_image ? (
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                  <img
                                    src={chama.cover_image}
                                    alt={chama.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-[#083232] to-[#2e856e] rounded-lg flex items-center justify-center text-white text-sm md:text-lg flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                  {chama.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs md:text-sm font-medium text-gray-900 truncate group-hover:text-[#083232] transition-colors">
                                  {chama.name}
                                </p>
                                <p className="text-[10px] md:text-xs text-gray-500 flex items-center gap-1">
                                  <svg
                                    className="w-2.5 h-2.5 md:w-3 md:h-3"
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
                  className="w-full h-8 md:h-10 pl-8 md:pl-10 pr-3 md:pr-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm md:text-base"
                />
                <svg
                  className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-white/60"
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

            <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
              {isAuthenticated ? (
                <>
                  <div className="text-white">
                    <NotificationsDropdown />
                  </div>
                  {/* Hide wallet on mobile since it's in bottom nav */}
                  <Link
                    href="/wallet"
                    className="hidden md:block p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Wallet className="w-5 h-5" />
                  </Link>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-0.5 md:gap-1 p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      {/* Show 3 dots on mobile, User icon on desktop */}
                      <MoreHorizontal className="w-4 h-4 md:hidden" />
                      <User className="hidden md:block w-5 h-5" />
                      <ChevronDown className="hidden md:block w-4 h-4" />
                    </button>

                    {showDropdown && (
                      <div className="fixed top-14 right-0 w-48 md:absolute md:top-auto md:left-0 md:right-auto md:mt-2 md:w-56 bg-white shadow-xl border border-gray-200 overflow-hidden text-gray-900 z-[100]">
                        {/* On chama page (mobile only): Show Cycle Settings for all members */}
                        {isChamaPage && isMember ? (
                          <>
                            {/* Mobile: Show Cycle Settings and Recent Activity (admin only) */}
                            <button
                              onClick={() => {
                                setShowDropdown(false);
                                onSettingsClick?.();
                              }}
                              className="md:hidden flex items-center px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                            >
                              <span className="text-xs">Cycle Settings</span>
                            </button>
                            
                            {/* Mobile: Show Recent Activity (admin only) */}
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setShowDropdown(false);
                                  onActivityClick?.();
                                }}
                                className="md:hidden flex items-center px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                              >
                                <span className="text-xs">Recent Activity</span>
                              </button>
                            )}
                            
                            {/* Desktop: Show normal dropdown */}
                            <div className="hidden md:block">
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
                                href="/loans"
                                onClick={() => setShowDropdown(false)}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                              >
                                <DollarSign className="w-4 h-4" />
                                <span className="text-sm">Loans</span>
                              </Link>
                              <Link
                                href="/investment/marketplace"
                                onClick={() => setShowDropdown(false)}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                  />
                                </svg>
                                <span className="text-sm">Investments</span>
                              </Link>
                              <Link
                                href="/profile"
                                onClick={() => setShowDropdown(false)}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                              >
                                <User className="w-4 h-4" />
                                <span className="text-sm">Profile</span>
                              </Link>
                              {/* Cycle Settings - Admin only */}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setShowDropdown(false);
                                    onSettingsClick?.();
                                  }}
                                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                                >
                                  <Settings className="w-4 h-4" />
                                  <span className="text-sm">Cycle Settings</span>
                                </button>
                              )}
                              {/* Recent Activity - Admin only */}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setShowDropdown(false);
                                    onActivityClick?.();
                                  }}
                                  className="flex items-center px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                                >
                                  <span className="text-sm">Recent Activity</span>
                                </button>
                              )}
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
                          </>
                        ) : (
                          <>
                            {/* User Info */}
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                              <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                                {userName}
                              </p>
                            </div>

                            {/* Menu Items */}
                            {/* Hide wallet on mobile since it's in bottom nav */}
                            <Link
                              href="/wallet"
                              onClick={() => setShowDropdown(false)}
                              className="hidden md:flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                            >
                              <Wallet className="w-4 h-4" />
                              <span className="text-sm">My Wallet</span>
                            </Link>
                            <Link
                              href="/loans"
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                            >
                              <DollarSign className="w-4 h-4" />
                              <span className="text-xs md:text-sm">Loans</span>
                            </Link>
                            {/* Hide investments on mobile since it's in bottom nav */}
                            <Link
                              href="/investment/marketplace"
                              onClick={() => setShowDropdown(false)}
                              className="hidden md:flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                />
                              </svg>
                              <span className="text-sm">Investments</span>
                            </Link>
                            <Link
                              href="/profile"
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                            >
                              <User className="w-4 h-4" />
                              <span className="text-xs md:text-sm">Profile</span>
                            </Link>
                            <Link
                              href="/settings"
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                            >
                              <Settings className="w-4 h-4" />
                              <span className="text-xs md:text-sm">Settings</span>
                            </Link>
                            <button
                              onClick={handleLogout}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left text-red-600"
                            >
                              <LogOut className="w-4 h-4" />
                              <span className="text-xs md:text-sm">Logout</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="px-3 md:px-4 py-1.5 md:py-2 hover:bg-white/10 text-white rounded-lg transition-colors font-medium text-sm md:text-base"
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
