import Link from "next/link";
import { Facebook, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#083232] text-white mt-auto">
      <div className="max-w-[1085px] mx-auto px-4 py-4">
        {/* Main Footer Content */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
          {/* Navigation Links */}
          <div className="flex flex-wrap gap-6 text-sm">
            <Link
              href="/about"
              className="hover:text-[#2e856e] transition-colors"
            >
              About Us
            </Link>
            <Link
              href="/contact"
              className="hover:text-[#2e856e] transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href="/support"
              className="hover:text-[#2e856e] transition-colors"
            >
              Support
            </Link>
            <Link
              href="/legal"
              className="hover:text-[#2e856e] transition-colors"
            >
              Legal
            </Link>
          </div>

          {/* Social Media Icons */}
          <div className="flex items-center gap-4">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-[#2e856e] rounded-lg transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-3 text-center text-sm text-white/60">
          <p>&copy; {new Date().getFullYear()} Cycles. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
