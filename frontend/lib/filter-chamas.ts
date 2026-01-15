/* eslint-disable @typescript-eslint/no-explicit-any */

export function filterChamas(
  chamas: any[],
  searchQuery: string,
  activeFilter: string
): any[] {
  return chamas.filter((chama: any) => {
    // Ensure chama has required fields
    if (
      !chama.name ||
      !chama.contribution_amount ||
      !chama.contribution_frequency
    ) {
      return false;
    }

    // Filter out hidden cycles - even admins shouldn't see hidden cycles on home page
    // (They can still access them via navbar dropdown which shows all member cycles)
    let settings = chama.settings || {};
    // Handle case where settings might be a JSON string
    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch {
        settings = {};
      }
    }
    if (settings.hidden === true) {
      return false;
    }

    // Search filter
    if (
      searchQuery &&
      !chama.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Category filter
    if (activeFilter === "all") {
      return true;
    }

    // Special filters
    if (activeFilter === "top-rated") {
      return chama.activity_score >= 90;
    }
    if (activeFilter === "most-active") {
      return chama.activity_score >= 85;
    }
    if (activeFilter === "high-returns") {
      return chama.roi >= 12;
    }

    // Type filters
    if (activeFilter === "investment") {
      return chama.type === "investment" || chama.tags?.includes("investment");
    }
    if (activeFilter === "lender") {
      return chama.lending_enabled === true || chama.tags?.includes("lender");
    }
    if (activeFilter === "savings-only") {
      return (
        chama.lending_enabled === false || chama.tags?.includes("savings-only")
      );
    }

    // Visibility filters
    if (activeFilter === "public") {
      return chama.is_public === true;
    }
    if (activeFilter === "private") {
      return chama.is_public === false;
    }

    // Frequency filters
    if (activeFilter === "daily") {
      return chama.contribution_frequency === "daily";
    }
    if (activeFilter === "weekly") {
      return chama.contribution_frequency === "weekly";
    }
    if (activeFilter === "monthly") {
      return chama.contribution_frequency === "monthly";
    }

    // Gender filters
    if (activeFilter === "women") {
      return chama.tags?.includes("women");
    }
    if (activeFilter === "men") {
      return chama.tags?.includes("men");
    }

    // Other tag-based filters
    if (chama.tags?.includes(activeFilter)) {
      return true;
    }

    return false;
  });
}
