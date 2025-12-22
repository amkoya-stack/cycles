"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownToLine, Building, Phone, Banknote, X } from "lucide-react";

interface ChamaDepositModalProps {
  isOpen: boolean;
  chamaId: string;
  chamaName: string;
  onClose: () => void;
  onSuccess: () => void;
}

type SourceType = "mpesa" | "bank" | "cash" | "other";

export function ChamaDepositModal({
  isOpen,
  chamaId,
  chamaName,
  onClose,
  onSuccess,
}: ChamaDepositModalProps) {
  const [amount, setAmount] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("mpesa");
  const [sourceReference, setSourceReference] = useState("");
  const [description, setDescription] = useState("");
  const [bankName, setBankName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!sourceReference) {
      setError("Please enter a reference number");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/ledger/chama/${chamaId}/deposit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            sourceType,
            sourceReference,
            description: description || `External deposit to ${chamaName}`,
            sourceDetails: sourceType === "bank" ? { bankName } : {},
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to process deposit");
      }

      onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process deposit"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setAmount("");
    setSourceType("mpesa");
    setSourceReference("");
    setDescription("");
    setBankName("");
    setError("");
  };

  const getSourceIcon = () => {
    switch (sourceType) {
      case "mpesa":
        return <Phone className="w-5 h-5 text-green-600" />;
      case "bank":
        return <Building className="w-5 h-5 text-blue-600" />;
      case "cash":
        return <Banknote className="w-5 h-5 text-yellow-600" />;
      default:
        return <ArrowDownToLine className="w-5 h-5 text-gray-600" />;
    }
  };

  const getReferencePlaceholder = () => {
    switch (sourceType) {
      case "mpesa":
        return "e.g., QH12ABC456";
      case "bank":
        return "e.g., TXN123456789";
      case "cash":
        return "e.g., Receipt #001";
      default:
        return "Reference number";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full p-6 shadow-2xl border-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#083232]/10 rounded-xl flex items-center justify-center">
              <ArrowDownToLine className="w-5 h-5 text-[#083232]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Deposit to Chama
              </h3>
              <p className="text-sm text-gray-500">{chamaName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Source Type */}
          <div>
            <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
              Deposit Source
            </label>
            <Select
              value={sourceType}
              onValueChange={(value) => setSourceType(value as SourceType)}
            >
              <SelectTrigger className="h-12">
                <div className="flex items-center gap-2">
                  {getSourceIcon()}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-600" />
                    M-Pesa
                  </div>
                </SelectItem>
                <SelectItem value="bank">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-600" />
                    Bank Transfer
                  </div>
                </SelectItem>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-yellow-600" />
                    Cash Deposit
                  </div>
                </SelectItem>
                <SelectItem value="other">
                  <div className="flex items-center gap-2">
                    <ArrowDownToLine className="w-4 h-4 text-gray-600" />
                    Other
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bank Name (only for bank transfers) */}
          {sourceType === "bank" && (
            <div>
              <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                Bank Name
              </label>
              <Input
                placeholder="e.g., KCB, Equity, NCBA"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="h-12"
              />
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
              Amount
            </label>
            <Input
              type="number"
              placeholder="10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl font-light text-center h-14 border-gray-200 focus:border-[#083232]"
            />
            <p className="text-xs text-gray-400 mt-1 text-center">KES</p>
          </div>

          {/* Source Reference */}
          <div>
            <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
              Reference Number
            </label>
            <Input
              placeholder={getReferencePlaceholder()}
              value={sourceReference}
              onChange={(e) => setSourceReference(e.target.value)}
              className="h-12"
            />
            <p className="text-xs text-gray-400 mt-1">
              {sourceType === "mpesa"
                ? "M-Pesa transaction code from SMS"
                : sourceType === "bank"
                ? "Bank transaction reference"
                : "Reference or receipt number"}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
              Description{" "}
              <span className="text-gray-400 normal-case">(optional)</span>
            </label>
            <Input
              placeholder="e.g., Migration from old account"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            <Button
              className="w-full bg-[#083232] hover:bg-[#2e856e] cursor-pointer h-12 rounded-xl font-medium"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : `Deposit KES ${amount || "0"}`}
            </Button>
            <Button
              variant="ghost"
              className="w-full cursor-pointer h-10 text-gray-500 hover:text-gray-700 font-normal"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
