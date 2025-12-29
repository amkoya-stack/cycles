/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    const redirect = searchParams.get("redirect");
    if (redirect) {
      setRedirectUrl(redirect);
    }
  }, [searchParams]);

  const normalizePhoneNumber = (phone: string): string => {
    // If it looks like an email, return as is
    if (phone.includes("@")) return phone;

    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, "");

    // If starts with 0, replace with +254
    if (cleaned.startsWith("0")) {
      return "+254" + cleaned.slice(1);
    }

    // If starts with 254, add +
    if (cleaned.startsWith("254")) {
      return "+" + cleaned;
    }

    // If already has +, return as is
    if (phone.startsWith("+")) {
      return phone;
    }

    // Otherwise, assume it needs +254 prefix
    return "+254" + cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Client-side validation
      if (!identifier.trim() || !password.trim()) {
        setLoading(false);
        throw new Error("Please enter your email/phone and password.");
      }

      // Normalize phone number if it's not an email
      const normalizedIdentifier = normalizePhoneNumber(identifier);

      // Determine if identifier is email or phone
      const isEmail = normalizedIdentifier.includes("@");
      const payload = isEmail
        ? { email: normalizedIdentifier, password }
        : { phone: normalizedIdentifier, password };

      const response = await fetch("http://localhost:3001/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // User-friendly error messages
        if (response.status === 401) {
          throw new Error("Invalid email/phone or password. Please try again.");
        } else if (response.status === 429) {
          throw new Error(
            "Too many login attempts. Please wait and try again."
          );
        } else if (response.status >= 500) {
          throw new Error("Server error. Please try again later.");
        } else {
          throw new Error(data.message || "Login failed. Please try again.");
        }
      }

      const data = await response.json();

      // Store tokens
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      // Check for intended destination after login
      const redirectAfterLogin = localStorage.getItem("redirectAfterLogin");
      if (redirectAfterLogin) {
        localStorage.removeItem("redirectAfterLogin");
        router.push(redirectAfterLogin);
      } else if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        router.push("/");
      }
    } catch (err: any) {
      // Always show user-friendly error
      setError(
        err.message ||
          "Unable to log in. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#083232] text-white">
        <div className="max-w-[1085px] mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold">Cycles</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-2xl font-bold text-[#083232] mb-2">
              Welcome back
            </h1>
            <p className="text-gray-600 mb-6">
              Login to continue to your account
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-[#f64d52] text-[#f64d52] rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="identifier" className="text-gray-700">
                  Email or Phone Number{" "}
                  <span className="text-[#f64d52]">*</span>
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your email or phone"
                  required
                  className="mt-1 h-11"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-gray-700">
                  Password <span className="text-[#f64d52]">*</span>
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link
                  href="/auth/forgot-password"
                  className="text-[#083232] hover:text-[#2e856e] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#083232] hover:bg-[#2e856e] text-white h-11 font-medium"
              >
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                href="/auth/register"
                className="text-[#083232] hover:text-[#2e856e] font-medium transition-colors"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
