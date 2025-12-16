"use client";

import { useState, useEffect, useRef } from "react";

interface ChamaFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = [
  { id: "all", label: "All" },
  { id: "top-rated", label: "Top-rated" },
  { id: "most-active", label: "Most active" },
  { id: "investment", label: "Investment" },
  { id: "lender", label: "Lender" },
  { id: "savings-only", label: "Savings-only" },
  { id: "public", label: "Public" },
  { id: "private", label: "Private" },
  { id: "rotating-buy", label: "Rotating buy" },
  { id: "high-returns", label: "High returns" },
  { id: "travel", label: "Travel" },
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

export function ChamaFilters({
  activeFilter,
  onFilterChange,
}: ChamaFiltersProps) {
  const [showMore, setShowMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(9); // Show first 9 by default
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateVisibleItems = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const moreButtonWidth = 70; // Width of "More..." button
      const gap = 8; // gap-2 = 8px

      // Estimate button widths based on text length
      const buttonWidths = filters.map((filter) => {
        // Approximate: 6px per character + 32px padding (px-4 = 16px each side)
        return filter.label.length * 6 + 32;
      });

      // First check if all items fit without More button
      const totalWidthAll = buttonWidths.reduce((sum, width, index) => {
        return sum + width + (index > 0 ? gap : 0);
      }, 0);

      if (totalWidthAll <= containerWidth) {
        setVisibleCount(filters.length);
        return;
      }

      // If not all fit, calculate with More button space
      let totalWidth = 0;
      let count = 0;

      for (let i = 0; i < filters.length; i++) {
        const newWidth = totalWidth + buttonWidths[i] + (count > 0 ? gap : 0);

        // Reserve space for More button
        if (newWidth + gap + moreButtonWidth > containerWidth) {
          break;
        }

        totalWidth = newWidth;
        count++;
      }

      setVisibleCount(Math.max(9, count)); // Always show at least 9 filters
    };

    calculateVisibleItems();
    window.addEventListener("resize", calculateVisibleItems);

    return () => window.removeEventListener("resize", calculateVisibleItems);
  }, []);

  const visibleFilters = filters.slice(0, visibleCount);
  const hiddenFilters = filters.slice(visibleCount);

  return (
    <div ref={containerRef}>
      {/* First line */}
      <div className="flex gap-2 overflow-hidden">
        {visibleFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={
              activeFilter === filter.id
                ? "px-4 py-2 rounded-full bg-[#083232] text-white text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer"
                : "px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:border-[#083232] hover:text-[#083232] transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer"
            }
          >
            {filter.label}
          </button>
        ))}

        {hiddenFilters.length > 0 && (
          <button
            onClick={() => setShowMore(!showMore)}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:border-[#083232] hover:text-[#083232] transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer"
          >
            {showMore ? "Less..." : "More..."}
          </button>
        )}
      </div>

      {/* Second line - shown when More is clicked */}
      {showMore && hiddenFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {hiddenFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={
                activeFilter === filter.id
                  ? "px-4 py-2 rounded-full bg-[#083232] text-white text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
                  : "px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:border-[#083232] hover:text-[#083232] transition-colors whitespace-nowrap cursor-pointer"
              }
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
