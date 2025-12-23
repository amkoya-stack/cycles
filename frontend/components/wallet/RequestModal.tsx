/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, User, X } from "lucide-react";
import { useChamas } from "@/hooks/use-chamas";

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  coMembers: any[];
  onRequestSent?: () => void;
}

export function RequestModal({
  isOpen,
  onClose,
  coMembers,
  onRequestSent,
}: RequestModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [requestType, setRequestType] = useState<"member" | "chama">("member");
  const { chamas, loading: chamasLoading } = useChamas();

  // Filter chamas where user is a member
  const userChamas = chamas.filter((chama) => chama.role);

  // Debug logging
  useEffect(() => {
    console.log("RequestModal - All chamas:", chamas);
    console.log("RequestModal - User chamas (with role):", userChamas);
    console.log("RequestModal - Chamas loading:", chamasLoading);
  }, [chamas, userChamas, chamasLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient || !amount) return;

    setLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const requestData = {
        amount: parseFloat(amount),
        description: description.trim() || `Request for ${amount} KES`,
        recipientId: requestType === "member" ? selectedRecipient.id : null,
        chamaId: requestType === "chama" ? selectedRecipient.id : null,
        requestType,
      };

      const response = await fetch("http://localhost:3001/api/wallet/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        // Reset form
        setAmount("");
        setDescription("");
        setSelectedRecipient(null);
        onRequestSent?.();
        onClose();
        alert("Request sent successfully!");
      } else {
        const error = await response.json();
        alert(`Failed to send request: ${error.message}`);
      }
    } catch (error) {
      console.error("Request failed:", error);
      alert("Failed to send request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Request Funds
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="What is this request for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <Tabs
            value={requestType}
            onValueChange={(value) =>
              setRequestType(value as "member" | "chama")
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="member">
                <User className="w-4 h-4 mr-2" />
                From Member
              </TabsTrigger>
              <TabsTrigger value="chama">
                <Users className="w-4 h-4 mr-2" />
                From Cycle
              </TabsTrigger>
            </TabsList>

            <TabsContent value="member" className="space-y-3">
              <Label>Select Member</Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {coMembers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No chama members found
                  </p>
                ) : (
                  coMembers.map((member) => {
                    const displayName =
                      member.full_name ||
                      `${member.first_name || ""} ${
                        member.last_name || ""
                      }`.trim();

                    return (
                      <div
                        key={member.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedRecipient?.id === member.id
                            ? "bg-[#083232] text-white border-[#083232]"
                            : "hover:bg-gray-50 border-gray-200"
                        }`}
                        onClick={() => setSelectedRecipient(member)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.profile_photo_url} />
                          <AvatarFallback>
                            {displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{displayName}</p>
                          <p className="text-xs text-gray-500">
                            {member.phone || "No phone"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="chama" className="space-y-3">
              <Label>Select Cycle</Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {userChamas.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {chamasLoading ? "Loading cycles..." : "No cycles found"}
                  </p>
                ) : (
                  userChamas.map((chama) => (
                    <div
                      key={chama.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedRecipient?.id === chama.id
                          ? "bg-[#083232] text-white border-[#083232]"
                          : "hover:bg-gray-50 border-gray-200"
                      }`}
                      onClick={() => setSelectedRecipient(chama)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={chama.cover_image} />
                        <AvatarFallback>
                          {chama.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{chama.name}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedRecipient || !amount}
              className="flex-1 bg-[#083232] hover:bg-[#2e856e]"
            >
              {loading ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
