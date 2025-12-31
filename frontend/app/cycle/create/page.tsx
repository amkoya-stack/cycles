/* eslint-disable prefer-const */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth";
import { apiUrl } from "@/lib/api-config";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ChamaType =
  | "savings"
  | "merry-go-round"
  | "investment"
  | "lending"
  | "mixed"
  | "rotating-buy";
type Visibility = "public" | "private" | "invite-only";
type ContributionType = "fixed" | "flexible" | "income-based";
type Frequency = "daily" | "weekly" | "monthly" | "custom";

export default function CreateChamaPage() {
  const router = useRouter();

  // Auth guard - redirect to login if token expired
  useAuthGuard();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    name: "",
    description: "",
    coverImage: null as File | null,
    coverImagePreview: "",

    // Step 2: Type Selection
    type: "savings" as ChamaType,

    // Step 3: Visibility
    visibility: "public" as Visibility,

    // Step 4: Contribution Settings
    contributionType: "fixed" as ContributionType,
    contributionAmount: "",
    contributionMin: "",
    contributionMax: "",
    incomePercentage: "",
    frequency: "monthly" as Frequency,
    customIntervalDays: "7", // For custom frequency

    // Step 5: Membership Rules
    minMembers: "2",
    maxMembers: "50",
    joiningFee: "",
    latePenaltyAmount: "",
    latePenaltyDays: "3",

    // Step 6: Constitution/Rules
    rules: "",
  });

  const totalSteps = 6;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      setError("");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError("");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      setFormData({
        ...formData,
        coverImage: file,
        coverImagePreview: URL.createObjectURL(file),
      });
      setError("");
    }
  };

  const handleRemoveImage = () => {
    if (formData.coverImagePreview) {
      URL.revokeObjectURL(formData.coverImagePreview);
    }
    setFormData({
      ...formData,
      coverImage: null,
      coverImagePreview: "",
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("No authentication token found. Please log in.");
        setLoading(false);
        setTimeout(() => router.push("/auth/login"), 2000);
        return;
      }

      // Prepare contribution settings based on type
      let contributionAmount = 0;
      const settings: any = {
        contributionType: formData.contributionType,
        visibility: formData.visibility,
        type: formData.type,
        minMembers: parseInt(formData.minMembers) || 2,
        joiningFee: parseFloat(formData.joiningFee) || 0,
        latePenalty: {
          amount: parseFloat(formData.latePenaltyAmount) || 0,
          graceDays: parseInt(formData.latePenaltyDays) || 3,
        },
        rules: formData.rules,
      };

      if (formData.contributionType === "fixed") {
        contributionAmount = parseFloat(formData.contributionAmount);
      } else if (formData.contributionType === "flexible") {
        settings.contributionRange = {
          min: parseFloat(formData.contributionMin),
          max: parseFloat(formData.contributionMax),
        };
        contributionAmount = parseFloat(formData.contributionMin); // Use min as base
      } else if (formData.contributionType === "income-based") {
        settings.incomePercentage = parseFloat(formData.incomePercentage);
        contributionAmount = 1000; // Placeholder, will vary per member
      }

      // Use frequency as-is
      let contributionFrequency = formData.frequency;
      let intervalDays = parseInt(formData.customIntervalDays);

      // Map frequency to interval days for backend
      if (formData.frequency === "daily") {
        intervalDays = 1;
      } else if (formData.frequency === "weekly") {
        intervalDays = 7;
      } else if (formData.frequency === "monthly") {
        intervalDays = 30;
      }
      // For custom, use the exact number entered

      // Generate unique externalReference for idempotency
      const externalReference = `chama-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`;

      // Convert image to base64 for storage (temporary solution until cloud upload is implemented)
      let coverImageUrl = null;
      if (formData.coverImage) {
        coverImageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(formData.coverImage!);
        });
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        contributionAmount,
        contributionFrequency,
        contributionIntervalDays: intervalDays, // Add interval days for flexible scheduling
        maxMembers: parseInt(formData.maxMembers) || 50,
        coverImage: coverImageUrl,
        settings,
        externalReference,
      };

      console.log(
        "Creating chama with payload:",
        JSON.stringify(payload, null, 2)
      );

      const response = await fetch(apiUrl("chama"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setError("Session expired. Please log in again.");
          setLoading(false);
          localStorage.removeItem("accessToken");
          setTimeout(() => router.push("/auth/login"), 2000);
          return;
        } else if (response.status === 400) {
          throw new Error(
            data.message || "Invalid information. Please check your details."
          );
        } else {
          throw new Error(
            data.message || "Failed to create cycle. Please try again."
          );
        }
      }

      const data = await response.json();

      // Redirect to the new cycle page using name as slug
      const slug = data.name.toLowerCase().replace(/\s+/g, "-");
      router.push(`/${encodeURIComponent(slug)}`);
    } catch (err: any) {
      setError(err.message || "Unable to create cycle. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim().length > 0;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        if (formData.contributionType === "fixed") {
          return parseFloat(formData.contributionAmount) > 0;
        } else if (formData.contributionType === "flexible") {
          return (
            parseFloat(formData.contributionMin) > 0 &&
            parseFloat(formData.contributionMax) >
              parseFloat(formData.contributionMin)
          );
        } else if (formData.contributionType === "income-based") {
          return parseFloat(formData.incomePercentage) > 0;
        }
        return false;
      case 5:
        return (
          parseInt(formData.minMembers) >= 2 &&
          parseInt(formData.maxMembers) > parseInt(formData.minMembers)
        );
      case 6:
        return true; // Rules are optional
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#083232] text-white py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Cycles
          </Link>
          <div className="text-sm">
            Step {currentStep} of {totalSteps}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full mx-1 ${
                  step <= currentStep ? "bg-[#083232]" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Basic Info</span>
            <span>Type</span>
            <span>Visibility</span>
            <span>Contribution</span>
            <span>Membership</span>
            <span>Rules</span>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-[#f64d52] text-[#f64d52] rounded-lg">
              {error}
            </div>
          )}

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#083232]">
                Basic Information
              </h2>

              <div>
                <Label htmlFor="name">
                  Cycle Name <span className="text-[#f64d52]">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. Smart Savers Circle"
                  className="mt-1"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.name.length}/100 characters
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Tell people what this cycle is about..."
                  className="mt-1"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.description.length}/500 characters
                </p>
              </div>

              <div>
                <Label>Cover Image</Label>
                <div className="mt-2">
                  {formData.coverImagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={formData.coverImagePreview}
                        alt="Cover preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#083232] transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">
                        Click to upload cover image
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        PNG, JPG up to 5MB
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleImageUpload}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Type Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#083232]">Cycle Type</h2>
              <p className="text-gray-600">
                What kind of cycle are you creating?
              </p>

              <div>
                <Label htmlFor="type">
                  Cycle Type <span className="text-[#f64d52]">*</span>
                </Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as ChamaType,
                    })
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#083232] focus:border-transparent"
                >
                  <option value="savings">
                    Savings - Members save regularly toward a common goal
                  </option>
                  <option value="merry-go-round">
                    Merry-go-round - Rotating payouts to members
                  </option>
                  <option value="investment">
                    Investment - Pool funds for investments and shared returns
                  </option>
                  <option value="lending">
                    Lending - Members can borrow from the pool
                  </option>
                  <option value="rotating-buy">
                    Rotational Purchase - Members take turns making bulk
                    purchases
                  </option>
                  <option value="mixed">
                    Mixed - Combination of multiple types
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Visibility */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#083232]">Visibility</h2>
              <p className="text-gray-600">Who can see and join this cycle?</p>

              <div className="grid grid-cols-1 gap-4">
                {[
                  {
                    id: "public",
                    label: "Public",
                    desc: "Anyone can see and request to join",
                  },
                  {
                    id: "private",
                    label: "Private",
                    desc: "Only visible to invited members",
                  },
                  {
                    id: "invite-only",
                    label: "Invite-only",
                    desc: "Visible to all, but join by invitation only",
                  },
                ].map((vis) => (
                  <button
                    key={vis.id}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        visibility: vis.id as Visibility,
                      })
                    }
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.visibility === vis.id
                        ? "border-[#083232] bg-[#083232]/5"
                        : "border-gray-200 hover:border-[#083232]/50"
                    }`}
                  >
                    <div className="font-semibold text-[#083232]">
                      {vis.label}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{vis.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Contribution Settings */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#083232]">
                Contribution Settings
              </h2>

              <div>
                <Label>
                  Contribution Type <span className="text-[#f64d52]">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  {[
                    { id: "fixed", label: "Fixed Amount" },
                    { id: "flexible", label: "Flexible Range" },
                    { id: "income-based", label: "Income-based %" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          contributionType: type.id as ContributionType,
                        })
                      }
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.contributionType === type.id
                          ? "border-[#083232] bg-[#083232]/5 text-[#083232]"
                          : "border-gray-200 hover:border-[#083232]/50"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {formData.contributionType === "fixed" && (
                <div>
                  <Label htmlFor="contributionAmount">
                    Amount (KES) <span className="text-[#f64d52]">*</span>
                  </Label>
                  <Input
                    id="contributionAmount"
                    type="number"
                    value={formData.contributionAmount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contributionAmount: e.target.value,
                      })
                    }
                    placeholder="1000"
                    className="mt-1"
                    min="1"
                  />
                </div>
              )}

              {formData.contributionType === "flexible" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contributionMin">
                      Minimum (KES) <span className="text-[#f64d52]">*</span>
                    </Label>
                    <Input
                      id="contributionMin"
                      type="number"
                      value={formData.contributionMin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contributionMin: e.target.value,
                        })
                      }
                      placeholder="500"
                      className="mt-1"
                      min="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contributionMax">
                      Maximum (KES) <span className="text-[#f64d52]">*</span>
                    </Label>
                    <Input
                      id="contributionMax"
                      type="number"
                      value={formData.contributionMax}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contributionMax: e.target.value,
                        })
                      }
                      placeholder="5000"
                      className="mt-1"
                      min="1"
                    />
                  </div>
                </div>
              )}

              {formData.contributionType === "income-based" && (
                <div>
                  <Label htmlFor="incomePercentage">
                    Income Percentage (%){" "}
                    <span className="text-[#f64d52]">*</span>
                  </Label>
                  <Input
                    id="incomePercentage"
                    type="number"
                    value={formData.incomePercentage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        incomePercentage: e.target.value,
                      })
                    }
                    placeholder="10"
                    className="mt-1"
                    min="0.1"
                    max="100"
                    step="0.1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentage of member's monthly income
                  </p>
                </div>
              )}

              <div>
                <Label>
                  Contribution Frequency{" "}
                  <span className="text-[#f64d52]">*</span>
                </Label>
                <div className="space-y-4 mt-2">
                  {/* Quick preset options */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { id: "daily", label: "Daily", days: 1 },
                      { id: "weekly", label: "Weekly", days: 7 },
                      { id: "monthly", label: "Monthly", days: 30 },
                      { id: "custom", label: "Custom", days: null },
                    ].map((freq) => (
                      <button
                        key={freq.id}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            frequency: freq.id as Frequency,
                            customIntervalDays: freq.days
                              ? freq.days.toString()
                              : formData.customIntervalDays,
                          });
                        }}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          formData.frequency === freq.id
                            ? "border-[#083232] bg-[#083232]/5 text-[#083232]"
                            : "border-gray-200 hover:border-[#083232]/50"
                        }`}
                      >
                        {freq.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom interval input */}
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">
                      Or specify exact interval (days between contributions)
                    </Label>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500">Every</span>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={formData.customIntervalDays}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customIntervalDays: e.target.value,
                            frequency:
                              parseInt(e.target.value) === 1
                                ? "daily"
                                : parseInt(e.target.value) === 7
                                ? "weekly"
                                : parseInt(e.target.value) === 30
                                ? "monthly"
                                : "custom",
                          })
                        }
                        className="w-20 text-center"
                        placeholder="7"
                      />
                      <span className="text-sm text-gray-500">days</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Examples: 1 = Daily, 3 = Every 3 days, 7 = Weekly, 14 =
                      Bi-weekly, 30 = Monthly
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Membership Rules */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#083232]">
                Membership Rules
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minMembers">
                    Minimum Members <span className="text-[#f64d52]">*</span>
                  </Label>
                  <Input
                    id="minMembers"
                    type="number"
                    value={formData.minMembers}
                    onChange={(e) =>
                      setFormData({ ...formData, minMembers: e.target.value })
                    }
                    placeholder="2"
                    className="mt-1"
                    min="2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum members to start cycle
                  </p>
                </div>

                <div>
                  <Label htmlFor="maxMembers">
                    Maximum Members <span className="text-[#f64d52]">*</span>
                  </Label>
                  <Input
                    id="maxMembers"
                    type="number"
                    value={formData.maxMembers}
                    onChange={(e) =>
                      setFormData({ ...formData, maxMembers: e.target.value })
                    }
                    placeholder="50"
                    className="mt-1"
                    min="2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum number of members
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="joiningFee">Joining Fee (KES)</Label>
                <Input
                  id="joiningFee"
                  type="number"
                  value={formData.joiningFee}
                  onChange={(e) =>
                    setFormData({ ...formData, joiningFee: e.target.value })
                  }
                  placeholder="0"
                  className="mt-1"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional one-time joining fee
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[#083232] mb-3">
                  Late Payment Penalty
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="latePenaltyAmount">
                      Penalty Amount (KES)
                    </Label>
                    <Input
                      id="latePenaltyAmount"
                      type="number"
                      value={formData.latePenaltyAmount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          latePenaltyAmount: e.target.value,
                        })
                      }
                      placeholder="0"
                      className="mt-1"
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="latePenaltyDays">Grace Period (Days)</Label>
                    <Input
                      id="latePenaltyDays"
                      type="number"
                      value={formData.latePenaltyDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          latePenaltyDays: e.target.value,
                        })
                      }
                      placeholder="3"
                      className="mt-1"
                      min="0"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Penalty applied after grace period expires
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Constitution/Rules */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#083232]">
                Cycle Constitution & Rules
              </h2>
              <p className="text-gray-600">
                Set custom rules and guidelines for your cycle members
              </p>

              <div>
                <Label htmlFor="rules">Rules & Guidelines</Label>
                <Textarea
                  id="rules"
                  value={formData.rules}
                  onChange={(e) =>
                    setFormData({ ...formData, rules: e.target.value })
                  }
                  placeholder="Example rules:&#10;• All contributions must be made by the 5th of each month&#10;• Members can request loans after 3 months of active contributions&#10;• Decisions require 75% majority vote&#10;• Late payments incur a 5% penalty&#10;• Members can exit with 30 days notice"
                  className="mt-1 font-mono text-sm"
                  rows={12}
                  maxLength={2000}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.rules.length}/2000 characters
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">
                  💡 Suggested Rules to Include:
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Payment deadlines and penalties</li>
                  <li>• Loan eligibility and terms</li>
                  <li>• Decision-making process (voting)</li>
                  <li>• Exit procedures</li>
                  <li>• Dispute resolution process</li>
                  <li>• Member responsibilities</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 bg-[#083232] hover:bg-[#2e856e]"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canProceed() || loading}
                className="bg-[#083232] hover:bg-[#2e856e]"
              >
                {loading ? "Creating..." : "Create Cycle"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
