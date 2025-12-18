import React from "react";
import {
  Badge as BadgeIcon,
  Award,
  Trophy,
  Star,
  Crown,
  Gem,
} from "lucide-react";

interface BadgeProps {
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  name: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const tierConfig = {
  bronze: {
    icon: BadgeIcon,
    gradient: "from-[#CD7F32] to-[#8B4513]",
    bg: "bg-gradient-to-br from-[#CD7F32]/20 to-[#8B4513]/10",
    border: "border-[#CD7F32]",
    text: "text-[#CD7F32]",
    glow: "shadow-[0_0_20px_rgba(205,127,50,0.3)]",
  },
  silver: {
    icon: Award,
    gradient: "from-[#C0C0C0] to-[#A8A8A8]",
    bg: "bg-gradient-to-br from-[#C0C0C0]/20 to-[#A8A8A8]/10",
    border: "border-[#C0C0C0]",
    text: "text-[#C0C0C0]",
    glow: "shadow-[0_0_20px_rgba(192,192,192,0.3)]",
  },
  gold: {
    icon: Trophy,
    gradient: "from-[#FFD700] to-[#FFA500]",
    bg: "bg-gradient-to-br from-[#FFD700]/20 to-[#FFA500]/10",
    border: "border-[#FFD700]",
    text: "text-[#FFD700]",
    glow: "shadow-[0_0_20px_rgba(255,215,0,0.4)]",
  },
  platinum: {
    icon: Star,
    gradient: "from-[#E5E4E2] to-[#BCC6CC]",
    bg: "bg-gradient-to-br from-[#E5E4E2]/20 to-[#BCC6CC]/10",
    border: "border-[#E5E4E2]",
    text: "text-[#E5E4E2]",
    glow: "shadow-[0_0_25px_rgba(229,228,226,0.4)]",
  },
  diamond: {
    icon: Gem,
    gradient: "from-[#b9f2ff] to-[#00bfff]",
    bg: "bg-gradient-to-br from-[#b9f2ff]/20 to-[#00bfff]/10",
    border: "border-[#00bfff]",
    text: "text-[#00bfff]",
    glow: "shadow-[0_0_30px_rgba(0,191,255,0.5)]",
  },
};

const sizeConfig = {
  sm: {
    container: "w-12 h-12",
    icon: 20,
    labelText: "text-xs",
  },
  md: {
    container: "w-16 h-16",
    icon: 28,
    labelText: "text-sm",
  },
  lg: {
    container: "w-24 h-24",
    icon: 40,
    labelText: "text-base",
  },
};

export function Badge({
  tier,
  name,
  description,
  size = "md",
  showLabel = true,
}: BadgeProps) {
  const config = tierConfig[tier];
  const sizeConf = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${sizeConf.container} ${config.bg} ${config.border} ${config.glow} 
                    border-2 rounded-full flex items-center justify-center
                    transition-transform hover:scale-110 cursor-pointer relative
                    backdrop-blur-sm`}
        title={description || name}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-10 rounded-full animate-pulse`}
        />
        <Icon className={config.text} size={sizeConf.icon} strokeWidth={2.5} />
      </div>

      {showLabel && (
        <div className="text-center">
          <p className={`${sizeConf.labelText} font-semibold ${config.text}`}>
            {name}
          </p>
          {description && size === "lg" && (
            <p className="text-xs text-gray-500 mt-1 max-w-[150px]">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface BadgeGridProps {
  badges: Array<{
    id: string;
    badge: {
      tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
      name: string;
      description: string;
    };
    awardedAt: string;
  }>;
  size?: "sm" | "md" | "lg";
}

export function BadgeGrid({ badges, size = "md" }: BadgeGridProps) {
  if (badges.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Trophy className="mx-auto mb-2 text-gray-400" size={48} />
        <p>No badges earned yet</p>
        <p className="text-sm mt-1">Keep contributing to earn badges!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {badges.map((award) => (
        <Badge
          key={award.id}
          tier={award.badge.tier}
          name={award.badge.name}
          description={award.badge.description}
          size={size}
          showLabel={true}
        />
      ))}
    </div>
  );
}
