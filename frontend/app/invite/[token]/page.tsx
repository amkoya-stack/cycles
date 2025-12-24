"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HomeNavbar } from "@/components/home/home-navbar";
import { Footer } from "@/components/footer";
import {
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface InviteDetails {
  inviteId: string;
  chamaId: string;
  chamaName: string;
  description: string;
  invitedBy: string;
  activeMembers: number;
  maxMembers: number;
  expiresAt: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInviteDetails();
    }
  }, [token]);

  const fetchInviteDetails = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/chama/invite/token/${token}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to load invite");
      }

      const data = await response.json();
      setInvite(data);
    } catch (err: any) {
      setError(err.message || "Invalid or expired invite");
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async () => {
    // Check authentication first
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      // Save intended action and redirect to login
      localStorage.setItem("redirectAfterLogin", `/invite/${token}`);
      router.push("/auth/login");
      return;
    }

    setAccepting(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:3001/api/chama/invite/token/${token}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to accept invite");
      }

      const data = await response.json();
      setSuccess(true);

      // Redirect to chama page after 2 seconds
      setTimeout(() => {
        router.push(`/${encodeURIComponent(data.chamaName)}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeNavbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#083232]" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeNavbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Invalid Invite
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button
              onClick={() => router.push("/")}
              className="bg-[#083232] hover:bg-[#2e856e]"
            >
              Go to Home
            </Button>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <HomeNavbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to {invite?.chamaName}!
            </h1>
            <p className="text-gray-600 mb-6">Redirecting to cycle page...</p>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <HomeNavbar />

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#083232] to-[#2e856e] flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              You're Invited!
            </h1>
            <p className="text-gray-600">
              {invite?.invitedBy} has invited you to join
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#083232]/5 to-[#2e856e]/5 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-[#083232] mb-2">
              {invite?.chamaName}
            </h2>
            <p className="text-gray-700 mb-4">{invite?.description}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>
                  {invite?.activeMembers} / {invite?.maxMembers} members
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>
                  Expires{" "}
                  {new Date(invite?.expiresAt || "").toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              onClick={acceptInvite}
              disabled={accepting}
              className="flex-1 bg-[#083232] hover:bg-[#2e856e]"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept & Join
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="flex-1"
            >
              Decline
            </Button>
          </div>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
