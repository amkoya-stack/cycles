import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TransferModalProps {
  isOpen: boolean;
  recipientPhone: string;
  amount: string;
  description: string;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function TransferModal({
  isOpen,
  recipientPhone,
  amount,
  description,
  onAmountChange,
  onDescriptionChange,
  onClose,
  onSubmit,
  isLoading,
}: TransferModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full p-6">
        <h3 className="text-xl font-bold mb-4">Transfer</h3>
        {description && (
          <p className="text-sm text-gray-600 mb-4">{description}</p>
        )}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              Amount (KES)
            </label>
            <Input
              type="number"
              placeholder="1000"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Description (Optional)
            </label>
            <Input
              placeholder="Payment for..."
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#083232] hover:bg-[#2e856e] cursor-pointer"
              onClick={onSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Send Money"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
