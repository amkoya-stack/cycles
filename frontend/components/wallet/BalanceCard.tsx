import { Card } from "@/components/ui/card";
import { Wallet, Plus, Minus, Send } from "lucide-react";

interface BalanceCardProps {
  balance: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onTransfer: () => void;
}

export function BalanceCard({
  balance,
  onDeposit,
  onWithdraw,
  onTransfer,
}: BalanceCardProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  return (
    <Card className="p-8 mb-8 bg-[#083232] text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-200 mb-1">Available Balance</p>
          <h2 className="text-4xl font-bold">{formatAmount(balance)}</h2>
        </div>
        <Wallet className="w-16 h-16 opacity-20" />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-6">
        <button
          onClick={onDeposit}
          className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Deposit
        </button>
        <button
          onClick={onWithdraw}
          className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
        >
          <Minus className="w-4 h-4" />
          Withdraw
        </button>
        <button
          onClick={onTransfer}
          className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          Transfer
        </button>
      </div>
    </Card>
  );
}
