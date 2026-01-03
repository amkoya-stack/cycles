"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Upload, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FileDisputeFormProps {
  chamaId: string;
  onDisputeFiled?: () => void;
  relatedTransactionId?: string;
  relatedLoanId?: string;
  relatedPayoutId?: string;
  relatedContributionId?: string;
  filedAgainstUserId?: string;
}

const DISPUTE_TYPES = [
  { value: "payment_dispute", label: "Payment Dispute" },
  { value: "payout_dispute", label: "Payout Dispute" },
  { value: "membership_dispute", label: "Membership Dispute" },
  { value: "loan_default", label: "Loan Default" },
  { value: "rule_violation", label: "Rule Violation" },
];

export function FileDisputeForm({
  chamaId,
  onDisputeFiled,
  relatedTransactionId,
  relatedLoanId,
  relatedPayoutId,
  relatedContributionId,
  filedAgainstUserId,
}: FileDisputeFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    disputeType: "",
    title: "",
    description: "",
    priority: "normal" as "low" | "normal" | "high" | "critical",
    amountDisputed: "",
    filedAgainstUserId: filedAgainstUserId || "",
  });
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // File dispute
      const disputeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            chamaId,
            disputeType: formData.disputeType,
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            amountDisputed: formData.amountDisputed
              ? parseFloat(formData.amountDisputed)
              : undefined,
            relatedTransactionId,
            relatedLoanId,
            relatedPayoutId,
            relatedContributionId,
            filedAgainstUserId: formData.filedAgainstUserId || undefined,
          }),
        }
      );

      if (!disputeResponse.ok) {
        const error = await disputeResponse.json();
        throw new Error(error.message || "Failed to file dispute");
      }

      const dispute = await disputeResponse.json();

      // Upload evidence files if any
      if (evidenceFiles.length > 0) {
        for (const file of evidenceFiles) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('evidenceType', 'document');
            formData.append('title', file.name);
            formData.append('description', `Evidence file: ${file.name}`);

            const evidenceResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/v1/disputes/${dispute.id}/evidence`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: formData,
              }
            );

            if (!evidenceResponse.ok) {
              console.error(`Failed to upload evidence file: ${file.name}`);
            }
          } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
          }
        }
      }

      toast({
        title: "Dispute filed successfully",
        description: "Your dispute has been filed and is under review.",
      });

      setOpen(false);
      setFormData({
        disputeType: "",
        title: "",
        description: "",
        priority: "normal",
        amountDisputed: "",
        filedAgainstUserId: "",
      });
      setEvidenceFiles([]);
      onDisputeFiled?.();
    } catch (error: any) {
      toast({
        title: "Error filing dispute",
        description: error.message || "Failed to file dispute",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setEvidenceFiles((prev) => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertCircle className="mr-2 h-4 w-4" />
          File Dispute
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>File a Dispute</DialogTitle>
          <DialogDescription>
            File a dispute to resolve conflicts within your chama. Provide
            detailed information and evidence.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disputeType">Dispute Type *</Label>
            <Select
              value={formData.disputeType}
              onValueChange={(value) =>
                setFormData({ ...formData, disputeType: value })
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select dispute type" />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Brief description of the dispute"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Provide detailed information about the dispute..."
              rows={6}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.disputeType === "payment_dispute" ||
              formData.disputeType === "payout_dispute") && (
              <div className="space-y-2">
                <Label htmlFor="amountDisputed">Amount Disputed (KES)</Label>
                <Input
                  id="amountDisputed"
                  type="number"
                  step="0.01"
                  value={formData.amountDisputed}
                  onChange={(e) =>
                    setFormData({ ...formData, amountDisputed: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence (Optional)</Label>
            <div className="border-2 border-dashed rounded-lg p-4">
              <Input
                id="evidence"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Upload documents, screenshots, or other evidence (PDF, images,
                documents)
              </p>
            </div>

            {evidenceFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {evidenceFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <span className="text-sm truncate flex-1">
                      {file.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Once filed, the dispute will be reviewed by chama administrators.
              You can add evidence and comments during the discussion phase.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Filing..." : "File Dispute"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

