/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUrl } from "@/lib/api-config";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const normalizePhoneNumber = (phone: string): string => {
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

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = normalizePhoneNumber(formData.phone);

      const response = await fetch(apiUrl("auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: normalizedPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // User-friendly error messages
        if (response.status === 400) {
          const errorMsg = data.message || "";
          if (errorMsg.includes("already exists")) {
            throw new Error(
              "An account with this email or phone already exists."
            );
          } else if (errorMsg.includes("email or phone")) {
            throw new Error("Please provide either an email or phone number.");
          } else {
            throw new Error(
              "Invalid information. Please check your details and try again."
            );
          }
        } else if (response.status >= 500) {
          throw new Error("Server error. Please try again later.");
        } else {
          throw new Error(
            data.message || "Registration failed. Please try again."
          );
        }
      }

      // Redirect to verification page with destination
      const verificationType = formData.email ? "email" : "phone";
      const destination = formData.email || normalizedPhone;
      router.push(
        `/auth/verify?type=${verificationType}&destination=${encodeURIComponent(
          destination
        )}`
      );
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
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
              Create your account
            </h1>
            <p className="text-gray-600 mb-6">
              Join thousands benefiting from the power of numbers
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-[#f64d52] text-[#f64d52] rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-gray-700">
                    First Name <span className="text-[#f64d52]">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    required
                    className="mt-1 h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-gray-700">
                    Last Name <span className="text-[#f64d52]">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                    required
                    className="mt-1 h-11"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-gray-700">
                  Email Address <span className="text-[#f64d52]">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  required
                  className="mt-1 h-11"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-gray-700">
                  Phone Number <span className="text-[#f64d52]">*</span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+254712345678"
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
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="At least 8 characters"
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

              <div>
                <Label htmlFor="confirmPassword" className="text-gray-700">
                  Confirm Password <span className="text-[#f64d52]">*</span>
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter your password"
                    required
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#083232] hover:bg-[#2e856e] text-white h-11 font-medium"
              >
                {loading ? "Creating account..." : "Register"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-[#083232] hover:text-[#2e856e] font-medium transition-colors"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
