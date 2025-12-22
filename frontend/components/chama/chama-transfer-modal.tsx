"use client";

import { useState, useEffect } from "react";
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
import { Send, X, Users, User, Phone, Building2 } from "lucide-react";

type DestinationType = "chama" | "user" | "mpesa" | "bank";

interface Chama {
  id: string;
  name: string;
  current_balance?: number;
}

interface ChamaMember {
  user_id: string;
  full_name: string;
  phone?: string;
}

interface ChamaTransferModalProps {
  isOpen: boolean;
  sourceChamaId: string;
  sourceChamaName: string;
  sourceChamaBalance: number;
  userChamas: Chama[];
  chamaMembers?: ChamaMember[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ChamaTransferModal({
  isOpen,
  sourceChamaId,
  sourceChamaName,
  sourceChamaBalance,
  userChamas,
  chamaMembers = [],
  onClose,
  onSuccess,
}: ChamaTransferModalProps) {
  const [destinationType, setDestinationType] =
    useState<DestinationType>("mpesa");
  const [destinationChamaId, setDestinationChamaId] = useState("");
  const [destinationUserId, setDestinationUserId] = useState("");
  const [destinationPhone, setDestinationPhone] = useState("");
  const [destinationBankName, setDestinationBankName] = useState("");
  const [destinationAccountNumber, setDestinationAccountNumber] = useState("");
  const [destinationAccountName, setDestinationAccountName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Filter out the source chama from available destinations
  const availableChamas = userChamas.filter((c) => c.id !== sourceChamaId);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    // Validate common fields
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > sourceChamaBalance) {
      setError("Insufficient balance in source chama");
      return;
    }

    if (!reason.trim()) {
      setError("Please provide a reason for the transfer");
      return;
    }

    // Validate destination-specific fields
    switch (destinationType) {
      case "chama":
        if (!destinationChamaId) {
          setError("Please select a destination chama");
          return;
        }
        break;
      case "user":
        if (!destinationUserId) {
          setError("Please select a member");
          return;
        }
        break;
      case "mpesa":
        if (!destinationPhone) {
          setError("Please enter an M-Pesa phone number");
          return;
        }
        if (
          !/^(?:254|\+254|0)?[17]\d{8}$/.test(
            destinationPhone.replace(/\s/g, "")
          )
        ) {
          setError("Please enter a valid Kenyan phone number");
          return;
        }
        break;
      case "bank":
        if (!destinationBankName || !destinationAccountNumber) {
          setError("Please enter bank name and account number");
          return;
        }
        break;
    }

    setIsLoading(true);
    setError("");

    try {
      const accessToken = localStorage.getItem("accessToken");

      // Build request body based on destination type
      const body: Record<string, unknown> = {
        destinationType,
        amount: parseFloat(amount),
        reason: reason.trim(),
        recipientName: getRecipientDisplayName(),
      };

      switch (destinationType) {
        case "chama":
          body.destinationChamaId = destinationChamaId;
          body.destinationChamaName =
            availableChamas.find((c) => c.id === destinationChamaId)?.name ||
            "";
          break;
        case "user":
          body.destinationUserId = destinationUserId;
          body.destinationUserName =
            chamaMembers.find((m) => m.user_id === destinationUserId)
              ?.full_name || "";
          break;
        case "mpesa":
          body.destinationPhone = formatPhoneNumber(destinationPhone);
          break;
        case "bank":
          body.destinationBankName = destinationBankName;
          body.destinationAccountNumber = destinationAccountNumber;
          body.destinationAccountName = destinationAccountName || recipientName;
          break;
      }

      const response = await fetch(
        `http://localhost:3001/api/ledger/chama/${sourceChamaId}/transfer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create transfer proposal");
      }

      const result = await response.json();

      alert(
        `Transfer proposal created! Members must vote to approve.\n\nProposal: ${
          result.proposal?.title || "Transfer"
        }\nVoting deadline: ${
          result.proposal?.votingDeadline
            ? new Date(result.proposal.votingDeadline).toLocaleDateString()
            : "72 hours"
        }`
      );

      onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process transfer"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setDestinationType("mpesa");
    setDestinationChamaId("");
    setDestinationUserId("");
    setDestinationPhone("");
    setDestinationBankName("");
    setDestinationAccountNumber("");
    setDestinationAccountName("");
    setRecipientName("");
    setAmount("");
    setReason("");
    setError("");
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\s/g, "").replace(/^\+/, "");
    if (cleaned.startsWith("0")) {
      return "254" + cleaned.substring(1);
    }
    if (!cleaned.startsWith("254")) {
      return "254" + cleaned;
    }
    return cleaned;
  };

  const getRecipientDisplayName = (): string => {
    if (recipientName) return recipientName;

    switch (destinationType) {
      case "chama":
        return (
          availableChamas.find((c) => c.id === destinationChamaId)?.name ||
          "Chama"
        );
      case "user":
        return (
          chamaMembers.find((m) => m.user_id === destinationUserId)
            ?.full_name || "Member"
        );
      case "mpesa":
        return destinationPhone || "M-Pesa Recipient";
      case "bank":
        return (
          destinationAccountName || destinationAccountNumber || "Bank Account"
        );
    }
  };

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("en-KE").format(value);
  };

  const getDestinationIcon = (type: DestinationType) => {
    switch (type) {
      case "chama":
        return <Users className="w-4 h-4" />;
      case "user":
        return <User className="w-4 h-4" />;
      case "mpesa":
        return <Phone className="w-4 h-4" />;
      case "bank":
        return <Building2 className="w-4 h-4" />;
    }
  };

  const getDestinationLabel = (type: DestinationType) => {
    switch (type) {
      case "chama":
        return "Another Cycle";
      case "user":
        return "Member Wallet";
      case "mpesa":
        return "M-Pesa";
      case "bank":
        return "Bank Account";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full p-6 shadow-2xl border-0 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#083232]/10 rounded-xl flex items-center justify-center">
              <Send className="w-5 h-5 text-[#083232]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Transfer Funds
              </h3>
              <p className="text-sm text-gray-500">From {sourceChamaName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Source Balance */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Available Balance</p>
          <p className="text-2xl font-bold text-[#083232]">
            KES {formatAmount(sourceChamaBalance)}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Destination Type Selector */}
          <div>
            <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
              Transfer To
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["mpesa", "bank", "user", "chama"] as DestinationType[]).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setDestinationType(type)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      destinationType === type
                        ? "border-[#083232] bg-[#083232]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`${
                        destinationType === type
                          ? "text-[#083232]"
                          : "text-gray-400"
                      }`}
                    >
                      {getDestinationIcon(type)}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        destinationType === type
                          ? "text-[#083232]"
                          : "text-gray-500"
                      }`}
                    >
                      {getDestinationLabel(type)}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Destination-specific fields */}
          {destinationType === "chama" && (
            <div>
              <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                Destination Cycle
              </label>
              {availableChamas.length === 0 ? (
                <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                  You need to be a member of another cycle to transfer funds.
                </p>
              ) : (
                <Select
                  value={destinationChamaId}
                  onValueChange={setDestinationChamaId}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select destination cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChamas.map((chama) => (
                      <SelectItem key={chama.id} value={chama.id}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#083232]" />
                          {chama.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {destinationType === "user" && (
            <div>
              <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                Member
              </label>
              {chamaMembers.length === 0 ? (
                <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                  No members available for transfer.
                </p>
              ) : (
                <Select
                  value={destinationUserId}
                  onValueChange={setDestinationUserId}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {chamaMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-[#083232]" />
                          {member.full_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {destinationType === "mpesa" && (
            <>
              <div>
                <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                  M-Pesa Phone Number
                </label>
                <Input
                  type="tel"
                  placeholder="0712 345 678"
                  value={destinationPhone}
                  onChange={(e) => setDestinationPhone(e.target.value)}
                  className="h-12"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Enter recipient&apos;s M-Pesa registered number
                </p>
              </div>
              <div>
                <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                  Recipient Name (Optional)
                </label>
                <Input
                  placeholder="e.g., John Supplier"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="h-11"
                />
              </div>
            </>
          )}

          {destinationType === "bank" && (
            <>
              <div>
                <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                  Bank Name
                </label>
                <Select
                  value={destinationBankName}
                  onValueChange={setDestinationBankName}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Equity Bank",
                      "KCB Bank",
                      "Co-operative Bank",
                      "ABSA Bank",
                      "Standard Chartered",
                      "Stanbic Bank",
                      "DTB Bank",
                      "NCBA Bank",
                      "I&M Bank",
                      "Family Bank",
                      "Prime Bank",
                      "Bank of Africa",
                      "Ecobank",
                      "Sidian Bank",
                      "Credit Bank",
                      "Victoria Commercial Bank",
                      "Other",
                    ].map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                  Account Number
                </label>
                <Input
                  placeholder="Enter account number"
                  value={destinationAccountNumber}
                  onChange={(e) => setDestinationAccountNumber(e.target.value)}
                  className="h-12"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                  Account Name
                </label>
                <Input
                  placeholder="Account holder name"
                  value={destinationAccountName}
                  onChange={(e) => setDestinationAccountName(e.target.value)}
                  className="h-11"
                />
              </div>
            </>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
              Amount
            </label>
            <Input
              type="number"
              placeholder="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl font-light text-center h-14 border-gray-200 focus:border-[#083232]"
              max={sourceChamaBalance}
            />
            <p className="text-xs text-gray-400 mt-1 text-center">KES</p>
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
              Reason for Transfer
            </label>
            <Input
              placeholder="e.g., Purchase equipment, Pay supplier, Emergency fund"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Transfer Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-sm text-amber-800">
                <span className="font-medium">⚠️ Requires Member Approval</span>
                <br />
                {destinationType === "mpesa" && (
                  <>
                    M-Pesa transfer of KES {formatAmount(parseFloat(amount))} to{" "}
                    <span className="font-medium">
                      {recipientName || destinationPhone || "recipient"}
                    </span>
                  </>
                )}
                {destinationType === "bank" && (
                  <>
                    Bank transfer of KES {formatAmount(parseFloat(amount))} to{" "}
                    <span className="font-medium">
                      {destinationAccountName ||
                        destinationAccountNumber ||
                        "account"}
                    </span>
                    {destinationBankName && ` (${destinationBankName})`}
                  </>
                )}
                {destinationType === "user" && (
                  <>
                    Transfer of KES {formatAmount(parseFloat(amount))} to member{" "}
                    <span className="font-medium">
                      {chamaMembers.find((m) => m.user_id === destinationUserId)
                        ?.full_name || "wallet"}
                    </span>
                  </>
                )}
                {destinationType === "chama" && (
                  <>
                    Transfer of KES {formatAmount(parseFloat(amount))} to{" "}
                    <span className="font-medium">
                      {availableChamas.find((c) => c.id === destinationChamaId)
                        ?.name || "cycle"}
                    </span>
                  </>
                )}
                <br />
                <span className="text-xs">
                  This will create a proposal that members must vote on.
                </span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4">
            <Button
              className="w-full bg-[#083232] hover:bg-[#2e856e] cursor-pointer h-12 rounded-xl font-medium"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Creating Proposal..." : "Create Transfer Proposal"}
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
