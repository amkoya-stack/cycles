"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Wallet, TrendingUp } from "lucide-react";

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      active: pathname === "/",
    },
    {
      href: "/chat",
      label: "Chat",
      icon: MessageCircle,
      active: pathname?.startsWith("/chat"),
    },
    {
      href: "/wallet",
      label: "Wallet",
      icon: Wallet,
      active: pathname?.startsWith("/wallet"),
    },
    {
      href: "/investment/marketplace",
      label: "Investments",
      icon: TrendingUp,
      active: pathname?.startsWith("/investment"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? "text-[#083232]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-0.5 ${
                  isActive ? "text-[#083232]" : "text-gray-500"
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? "text-[#083232]" : "text-gray-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

