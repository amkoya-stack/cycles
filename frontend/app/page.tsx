"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChamaSearch } from "@/components/chama/chama-search";
import { ChamaFilters } from "@/components/chama/chama-filters";
import { HomeNavbar } from "@/components/home/home-navbar";
import { HomeHeader } from "@/components/home/home-header";
import { ChamaGrid } from "@/components/home/chama-grid";
import { Pagination } from "@/components/home/pagination";
import { Footer } from "@/components/footer";
import { useAuth } from "@/hooks/use-auth";
import { useChamas } from "@/hooks/use-chamas";
import { filterChamas } from "@/lib/filter-chamas";

const ITEMS_PER_PAGE = 30;

export default function HomePage() {
  const router = useRouter();
  const searchBarRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showSearchInNav, setShowSearchInNav] = useState(false);

  const { isAuthenticated, validateToken } = useAuth();
  const { chamas, loading, fetchChamas } = useChamas();

  useEffect(() => {
    validateToken();
    fetchChamas();
  }, [validateToken, fetchChamas]);

  // Re-check auth on mount and when localStorage changes (for after OTP verification)
  useEffect(() => {
    const checkAuth = () => {
      validateToken();
    };

    // Listen for storage events (e.g., when tokens are added)
    window.addEventListener("storage", checkAuth);

    return () => window.removeEventListener("storage", checkAuth);
  }, [validateToken]);

  useEffect(() => {
    const handleScroll = () => {
      if (searchBarRef.current) {
        const searchBarBottom =
          searchBarRef.current.getBoundingClientRect().bottom;
        setShowSearchInNav(searchBarBottom < 0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredChamas = filterChamas(chamas, searchQuery, activeFilter);

  // Pagination
  const totalPages = Math.ceil(filteredChamas.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedChamas = filteredChamas.slice(startIndex, endIndex);

  const handleJoinChama = (chama: any) => {
    if (!isAuthenticated) {
      const slug = chama.name.toLowerCase().replace(/\s+/g, "-");
      router.push(`/auth/login?redirect=/${encodeURIComponent(slug)}`);
      return;
    }
    // Redirect to cycle detail page
    const slug = chama.name.toLowerCase().replace(/\s+/g, "-");
    router.push(`/${encodeURIComponent(slug)}`);
  };

  const handleViewChama = (chama: any) => {
    const slug = chama.name.toLowerCase().replace(/\s+/g, "-");
    router.push(`/${encodeURIComponent(slug)}`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeNavbar
        isAuthenticated={isAuthenticated}
        showSearchInNav={showSearchInNav}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 pt-16">
        <main className="max-w-[1085px] mx-auto px-4 py-8">
          <HomeHeader isAuthenticated={isAuthenticated} />

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
          <ChamaGrid
            loading={loading}
            chamas={paginatedChamas}
            onJoin={(chamaId) => {
              const chama = paginatedChamas.find((c) => c.id === chamaId);
              if (chama) handleJoinChama(chama);
            }}
            onView={(chamaId) => {
              const chama = paginatedChamas.find((c) => c.id === chamaId);
              if (chama) handleViewChama(chama);
            }}
          />

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </main>
      </div>

      <Footer />
    </div>
  );
}
