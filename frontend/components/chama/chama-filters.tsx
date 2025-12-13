"use client";

import { useState, useEffect, useRef } from "react";

interface ChamaFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = [
  { id: "all", label: "All" },
  { id: "savings", label: "Savings" },
  { id: "investment", label: "Investment" },
  { id: "rotating-items", label: "Rotating Items" },
  { id: "women", label: "Women" },
  { id: "youth", label: "Youth" },
  { id: "high-trust", label: "High Trust" },
  { id: "accepts-borrowers", label: "Accepts Borrowers" },
  { id: "high-returns", label: "High Returns" },
  { id: "private", label: "Private" },
];

export function ChamaFilters({
  activeFilter,
  onFilterChange,
}: ChamaFiltersProps) {
  const [showMore, setShowMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(filters.length);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateVisibleItems = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const moreButtonWidth = 70; // Width of "More..." button
      const gap = 8; // gap-2 = 8px

      // Estimate button widths based on text length
      const buttonWidths = filters.map((filter) => {
        // Approximate: 6.5px per character + 32px padding (px-4 = 16px each side)
        return filter.label.length * 6.5 + 32;
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

      setVisibleCount(Math.max(1, count));
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
      <div className="flex flex-wrap gap-2">
        {visibleFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={
              activeFilter === filter.id
                ? "px-4 py-2 rounded-full bg-[#083232] text-white text-sm font-medium transition-colors whitespace-nowrap"
                : "px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:border-[#083232] hover:text-[#083232] transition-colors whitespace-nowrap"
            }
          >
            {filter.label}
          </button>
        ))}

        {hiddenFilters.length > 0 && (
          <button
            onClick={() => setShowMore(!showMore)}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:border-[#083232] hover:text-[#083232] transition-colors whitespace-nowrap"
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
                  ? "px-4 py-2 rounded-full bg-[#083232] text-white text-sm font-medium transition-colors whitespace-nowrap"
                  : "px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:border-[#083232] hover:text-[#083232] transition-colors whitespace-nowrap"
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
