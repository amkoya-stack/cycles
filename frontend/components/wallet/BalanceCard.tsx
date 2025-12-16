import { Card } from "@/components/ui/card";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownLeft,
  Receipt,
} from "lucide-react";

interface BalanceCardProps {
  balance: number;
  onDeposit: () => void;
  onWithdraw: () => void;
  onRequest: () => void;
  onReceipts: () => void;
}

export function BalanceCard({
  balance,
  onDeposit,
  onWithdraw,
  onRequest,
  onReceipts,
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
          <ArrowDownToLine className="w-4 h-4" />
          Deposit
        </button>
        <button
          onClick={onWithdraw}
          className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Withdraw
        </button>
        <button
          onClick={onRequest}
          className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
        >
          <ArrowDownLeft className="w-4 h-4" />
          Request
        </button>
        <button
          onClick={onReceipts}
          className="flex items-center gap-2 text-white hover:text-gray-200 cursor-pointer"
        >
          <Receipt className="w-4 h-4" />
          Receipts
        </button>
      </div>
    </Card>
  );
}
