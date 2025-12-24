"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link2, Mail, Phone, Copy, CheckCircle, Loader2 } from "lucide-react";

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  chamaId: string;
  chamaName: string;
}

export function InviteMemberModal({
  open,
  onClose,
  chamaId,
  chamaName,
}: InviteMemberModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const generateInviteLink = async () => {
    setLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ generateLink: true }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate invite link");
      }

      const data = await response.json();
      setInviteLink(data.inviteLink);

      toast({
        title: "Invite link generated!",
        description: "Share this link with people you want to invite",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate invite link",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendInviteByEmail = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an email address",
      });
      return;
    }

    setLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ email, generateLink: true }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send invite");
      }

      toast({
        title: "Invite sent!",
        description: `Invitation sent to ${email}`,
      });

      setEmail("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invite",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendInviteByPhone = async () => {
    if (!phone) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a phone number",
      });
      return;
    }

    setLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await fetch(
        `http://localhost:3001/api/chama/${chamaId}/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ phone, generateLink: true }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send invite");
      }

      toast({
        title: "Invite sent!",
        description: `SMS invitation sent to ${phone}`,
      });

      setPhone("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invite",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy link",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Members to {chamaName}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">
              <Link2 className="w-4 h-4 mr-2" />
              Link
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="w-4 h-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="phone">
              <Phone className="w-4 h-4 mr-2" />
              Phone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            <p className="text-sm text-gray-600">
              Generate a shareable link that anyone can use to join this cycle
            </p>

            {inviteLink ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Link expires in 7 days</p>
              </div>
            ) : (
              <Button
                onClick={generateInviteLink}
                disabled={loading}
                className="w-full bg-[#083232] hover:bg-[#2e856e]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Generate Invite Link
                  </>
                )}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              onClick={sendInviteByEmail}
              disabled={loading}
              className="w-full bg-[#083232] hover:bg-[#2e856e]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email Invite
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="phone" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button
              onClick={sendInviteByPhone}
              disabled={loading}
              className="w-full bg-[#083232] hover:bg-[#2e856e]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Send SMS Invite
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
