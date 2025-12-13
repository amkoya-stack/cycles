"use client";

import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

interface LayoutClientProps {
  children: ReactNode;
  showSearchInNav?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export function LayoutClient({
  children,
  showSearchInNav,
  searchValue,
  onSearchChange,
}: LayoutClientProps) {
  return (
    <>
      <Navbar
        showSearch={showSearchInNav}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
      />
      {children}
      <Footer />
    </>
  );
}
