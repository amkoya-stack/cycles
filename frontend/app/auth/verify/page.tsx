/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const type = searchParams.get("type") || "email"; // email or phone
  const destination = searchParams.get("destination") || ""; // email or phone value

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const endpoint =
        type === "email"
          ? "http://localhost:3001/api/auth/verify-email"
          : "http://localhost:3001/api/auth/verify-phone";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [type]: destination,
          otp,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // User-friendly error messages
        if (response.status === 404) {
          throw new Error(
            "Verification service unavailable. Please try again later."
          );
        } else if (response.status === 400) {
          throw new Error("Invalid or expired code. Please try again.");
        } else if (response.status === 429) {
          throw new Error(
            "Too many attempts. Please wait before trying again."
          );
        } else if (response.status >= 500) {
          throw new Error("Server error. Please try again later.");
        } else {
          throw new Error(
            data.message || "Verification failed. Please check your code."
          );
        }
      }

      const data = await response.json();

      // Store tokens if provided
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
      }

      setSuccess(
        `${type === "email" ? "Email" : "Phone"} verified successfully!`
      );

      // Redirect to home or dashboard after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      // Always show user-friendly error message
      setError(
        err.message ||
          "Unable to verify. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");
    setResending(true);

    if (!destination) {
      setError("Cannot resend code. Please try registering again.");
      setResending(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:3001/api/auth/otp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: type === "email" ? "email" : "sms",
          destination: destination,
          purpose:
            type === "email" ? "email_verification" : "phone_verification",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // User-friendly error messages instead of raw errors
        if (response.status === 429) {
          throw new Error(
            "Too many requests. Please wait a moment and try again."
          );
        } else if (response.status === 404) {
          throw new Error("Service unavailable. Please try again later.");
        } else if (response.status >= 500) {
          throw new Error("Server error. Please try again later.");
        } else {
          throw new Error(
            data.message ||
              "Failed to send verification code. Please try again."
          );
        }
      }

      setSuccess("Verification code sent! Check your " + type + ".");
    } catch (err: any) {
      // Show user-friendly error message
      setError(
        err.message ||
          "Unable to send code. Please check your connection and try again."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#083232] text-white py-4">
        <div className="max-w-md mx-auto px-4">
          <Link href="/" className="text-2xl font-bold">
            Cycles
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-2xl font-bold text-[#083232] mb-2">
              Verify your {type === "email" ? "email" : "phone number"}
            </h1>
            <p className="text-gray-600 mb-6">
              Enter the 6-digit code sent to your{" "}
              {type === "email" ? "email address" : "phone number"}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-[#f64d52] text-[#f64d52] rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-500 text-green-700 rounded-lg text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="otp" className="text-gray-700">
                  Verification Code <span className="text-[#f64d52]">*</span>
                </Label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit code"
                  required
                  maxLength={6}
                  className="mt-1 h-11 text-center text-2xl tracking-widest"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-[#083232] hover:bg-[#2e856e] text-white h-11 font-medium"
              >
                {loading ? "Verifying..." : "Verify"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-2">
                Didn't receive the code?
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-[#083232] hover:text-[#2e856e] font-medium transition-colors disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend code"}
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-gray-600">
              <Link
                href="/auth/login"
                className="text-[#083232] hover:text-[#2e856e] font-medium transition-colors"
              >
                Back to login
              </Link>
              <span className="mx-2 text-gray-400">•</span>
              <Link
                href="/auth/register"
                className="text-[#083232] hover:text-[#2e856e] font-medium transition-colors"
              >
                Back to register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
