/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChamaSearch } from "@/components/chama/chama-search";
import { ChamaFilters } from "@/components/chama/chama-filters";
import { ChamaCard } from "@/components/chama/chama-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const ITEMS_PER_PAGE = 30;

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [chamas, setChamas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSearchInNav, setShowSearchInNav] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchChamas();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (searchBarRef.current) {
        const searchBarBottom = searchBarRef.current.getBoundingClientRect().bottom;
        // Show search in navbar when original search bar scrolls past top
        setShowSearchInNav(searchBarBottom < 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchChamas = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/chama', {
      //   headers: {
      //     'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      //   }
      // });
      // const data = await response.json();
      // setChamas(data);

      // Mock data for now
      setChamas([
        {
          id: "1",
          name: "Smart Farmers Circle",
          description:
            "Agricultural cooperative supporting local farmers with micro-loans and group savings",
          icon: "🟡",
          cover_image: "",
          is_public: true,
          lending_enabled: true,
          members_count: 1800,
          contribution_amount: 1000,
          contribution_frequency: "monthly",
          roi: 12,
          default_rate: "Low",
        },
        {
          id: "2",
          name: "Tech Entrepreneurs Hub",
          description:
            "Supporting tech startups through collective investment and networking opportunities",
          icon: "💻",
          cover_image: "",
          is_public: true,
          lending_enabled: true,
          members_count: 450,
          contribution_amount: 5000,
          contribution_frequency: "monthly",
          roi: 18,
          default_rate: "Medium",
        },
        {
          id: "3",
          name: "Women Empowerment Fund",
          description:
            "Empowering women through financial independence and business development support",
          icon: "👩",
          cover_image: "",
          is_public: true,
          lending_enabled: false,
          members_count: 2200,
          contribution_amount: 2000,
          contribution_frequency: "monthly",
          roi: 10,
          default_rate: "Low",
        },
        {
          id: "4",
          name: "Youth Investment Club",
          description:
            "Young professionals building wealth together through smart investing",
          icon: "🚀",
          cover_image: "",
          is_public: false,
          lending_enabled: true,
          members_count: 120,
          contribution_amount: 10000,
          contribution_frequency: "monthly",
          roi: 22,
          default_rate: "High",
        },
        {
          id: "5",
          name: "Boda Boda Sacco",
          description:
            "Motorcycle taxi operators saving for asset acquisition and emergency funds",
          icon: "🏍️",
          cover_image: "",
          is_public: true,
          lending_enabled: true,
          members_count: 3500,
          contribution_amount: 500,
          contribution_frequency: "weekly",
          roi: 8,
          default_rate: "Low",
        },
        {
          id: "6",
          name: "Business Growth Fund",
          description:
            "SME owners pooling resources for expansion and inventory financing",
          icon: "📈",
          cover_image: "",
          is_public: false,
          lending_enabled: true,
          members_count: 85,
          contribution_amount: 15000,
          contribution_frequency: "monthly",
          roi: 25,
          default_rate: "Medium",
        },
        {
          id: "7",
          name: "Teachers Welfare Group",
          description:
            "Educators building financial security through collective savings and investment",
          icon: "📚",
          cover_image: "",
          is_public: true,
          lending_enabled: false,
          members_count: 680,
          contribution_amount: 3000,
          contribution_frequency: "monthly",
          roi: 11,
          default_rate: "Low",
        },
        {
          id: "8",
          name: "Mama Mboga Collective",
          description:
            "Market vendors supporting each other with daily savings and micro-credit",
          icon: "🥬",
          cover_image: "",
          is_public: true,
          lending_enabled: true,
          members_count: 1200,
          contribution_amount: 200,
          contribution_frequency: "weekly",
          roi: 9,
          default_rate: "Low",
        },
        {
          id: "9",
          name: "Real Estate Investors",
          description:
            "Property investment group pooling capital for land and development projects",
          icon: "🏘️",
          cover_image: "",
          is_public: false,
          lending_enabled: true,
          members_count: 45,
          contribution_amount: 50000,
          contribution_frequency: "monthly",
          roi: 30,
          default_rate: "High",
        },
        {
          id: "10",
          name: "Health Workers Fund",
          description:
            "Medical professionals saving for continuing education and equipment",
          icon: "⚕️",
          cover_image: "",
          is_public: true,
          lending_enabled: false,
          members_count: 320,
          contribution_amount: 4000,
          contribution_frequency: "monthly",
          roi: 13,
          default_rate: "Low",
        },
        {
          id: "11",
          name: "Freelancers Alliance",
          description:
            "Independent contractors building financial stability through group savings",
          icon: "💼",
          cover_image: "",
          is_public: true,
          lending_enabled: true,
          members_count: 890,
          contribution_amount: 2500,
          contribution_frequency: "monthly",
          roi: 15,
          default_rate: "Medium",
        },
        {
          id: "12",
          name: "Church Welfare Group",
          description:
            "Faith-based community supporting members with emergency funds and loans",
          icon: "⛪",
          cover_image: "",
          is_public: false,
          lending_enabled: true,
          members_count: 560,
          contribution_amount: 1500,
          contribution_frequency: "monthly",
          roi: 7,
          default_rate: "Low",
        },
      ]);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch chamas:", error);
      setLoading(false);
    }
  };

  const filteredChamas = chamas.filter((chama) => {
    // Search filter
    if (
      searchQuery &&
      !chama.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Category filter
    if (activeFilter !== "all") {
      if (activeFilter === "my-chamas") return false; // TODO: Filter by user's chamas
      if (activeFilter === "admin") return false; // TODO: Filter by admin role
      if (activeFilter === "active") return true; // All are active for now
      if (activeFilter === "completed") return false; // None completed for now
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredChamas.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedChamas = filteredChamas.slice(startIndex, endIndex);

  const handleJoinChama = (chamaId: string) => {
    // TODO: Implement join logic
    console.log("Join chama:", chamaId);
  };

  const handleViewChama = (chamaId: string) => {
    router.push(`/chama/${chamaId}`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50">
        <nav className="bg-[#083232] text-white shadow-md">
          <div className="max-w-[1085px] mx-auto px-4">
            <div className="flex items-center justify-between h-16 gap-4">
              <Link href="/" className="flex items-center space-x-2 flex-shrink-0">
                <span className="text-xl font-bold">Cycles</span>
              </Link>

              {showSearchInNav && (
                <div className="flex-1 max-w-[500px] relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                <button className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors relative">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#f64d52] rounded-full"></span>
                </button>
                <Link href="/wallet" className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </Link>
                <Link href="/profile" className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </div>
    <div className="flex-1 bg-gray-50 pt-16">
      <main className="max-w-[1085px] mx-auto px-4 py-8">
        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-[#083232]">
            #1 social fintech in kenya
          </h1>
          <h3 className="text-lg text-gray-600 mt-1">
            browse or create a cycle
          </h3>
        </div>

        {/* Search Bar */}
        <div ref={searchBarRef} className="mb-6 flex justify-center">
          <div className="w-[650px]">
            <ChamaSearch value={searchQuery} onChange={setSearchQuery} />
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 flex justify-center">
          <div className="w-full max-w-[1059px]">
            <ChamaFilters
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          </div>
        </div>

        {/* Chama Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#083232]"></div>
          </div>
        ) : filteredChamas.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-600 text-lg mb-4">No cycles found</p>
            <Link href="/chama/create">
              <Button className="bg-[#083232] hover:bg-[#2e856e] text-white">
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Cycle
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedChamas.map((chama) => (
                <ChamaCard
                  key={chama.id}
                  chama={chama}
                  onJoin={handleJoinChama}
                  onView={handleViewChama}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-[#083232]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={
                        currentPage === page
                          ? "bg-[#083232] hover:bg-[#2e856e] text-white"
                          : "border-[#083232] text-[#083232] hover:bg-[#083232] hover:text-white"
                      }
                    >
                      {page}
                    </Button>
                  )
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="border-[#083232]"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
    </>
  );
}
