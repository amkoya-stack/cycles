import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DepositModalProps {
  isOpen: boolean;
  userPhone: string;
  amount: string;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function DepositModal({
  isOpen,
  userPhone,
  amount,
  onAmountChange,
  onClose,
  onSubmit,
  isLoading,
}: DepositModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-[320px] w-full p-8 shadow-2xl border-0">
        <h3 className="text-2xl font-semibold mb-8 text-center text-gray-900">
          Deposit
        </h3>
        <div className="space-y-6">
          <div>
            <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
              Amount
            </label>
            <Input
              type="number"
              placeholder="1000"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="text-2xl font-light text-center h-14 border-gray-200 focus:border-[#083232]"
            />
            <p className="text-xs text-gray-400 mt-1 text-center">KES</p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Button
              className="w-full bg-[#083232] hover:bg-[#2e856e] cursor-pointer h-12 rounded-xl font-medium"
              onClick={onSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Continue"}
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
