import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TransferModalProps {
  isOpen: boolean;
  recipientPhone: string;
  recipientName?: string;
  amount: string;
  description: string;
  chamaId?: string | null;
  onPhoneChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function TransferModal({
  isOpen,
  recipientPhone,
  recipientName,
  amount,
  description,
  chamaId,
  onPhoneChange,
  onAmountChange,
  onDescriptionChange,
  onClose,
  onSubmit,
  isLoading,
}: TransferModalProps) {
  if (!isOpen) return null;

  const isRecipientPreSelected = !!recipientName;
  const isChamaContribution = !!chamaId;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-[320px] w-full p-6 shadow-2xl border-0">
        <h3 className="text-xl font-semibold mb-1 text-center text-gray-900">
          {isChamaContribution ? "Contribute" : "Send Money"}
        </h3>
        {isRecipientPreSelected && (
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-500 mb-1">
              {isChamaContribution ? "Contributing to" : "Transfer to"}
            </p>
            <p className="text-lg font-semibold text-[#083232]">
              {recipientName}
            </p>
          </div>
        )}
        <div className="space-y-4">
          {!isRecipientPreSelected && (
            <div>
              <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                Recipient
              </label>
              <Input
                type="text"
                placeholder="Phone, email, or name"
                value={recipientPhone}
                onChange={(e) => onPhoneChange(e.target.value)}
                className="text-lg font-light h-12 border-gray-200 focus:border-[#083232]"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter phone number, email address, or full name
              </p>
            </div>
          )}
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
          {!isRecipientPreSelected && (
            <div>
              <label className="text-xs font-medium mb-2 block text-gray-500 uppercase tracking-wide">
                Note{" "}
                <span className="text-gray-400 normal-case">(optional)</span>
              </label>
              <Input
                placeholder="What's this for?"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                className="text-base font-light h-11 border-gray-200 focus:border-[#083232]"
              />
            </div>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full bg-[#083232] hover:bg-[#2e856e] cursor-pointer h-11 rounded-xl font-medium"
              onClick={onSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Send"}
            </Button>
            <Button
              variant="ghost"
              className="w-full cursor-pointer h-9 text-gray-500 hover:text-gray-700 font-normal text-sm"
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
