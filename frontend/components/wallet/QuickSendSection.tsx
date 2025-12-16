/* eslint-disable @typescript-eslint/no-explicit-any */
import { Plus } from "lucide-react";

interface QuickSendSectionProps {
  chamas: any[];
  coMembers: any[];
  onChamaClick: (chama: any) => void;
  onMemberClick: (member: any) => void;
  onAddRecipient: () => void;
}

export function QuickSendSection({
  chamas,
  coMembers,
  onChamaClick,
  onMemberClick,
  onAddRecipient,
}: QuickSendSectionProps) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-3">Quick send</h3>
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        <button
          onClick={onAddRecipient}
          className="text-gray-700 hover:text-gray-900 flex-shrink-0 cursor-pointer mt-2"
          title="Add new recipient"
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* Chamas */}
        {chamas
          .filter((chama: any) => chama.role)
          .map((chama: any) => (
            <button
              key={`chama-${chama.id}`}
              className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer"
              title={chama.name}
              onClick={() => onChamaClick(chama)}
            >
              <div className="w-10 h-10 rounded-full bg-[#083232] flex items-center justify-center text-white font-semibold text-xs group-hover:bg-[#2e856e] transition-colors">
                {chama.profile_picture ? (
                  <img
                    src={chama.profile_picture}
                    alt={chama.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  chama.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-[10px] text-gray-700 font-medium max-w-[56px] truncate text-center leading-tight">
                {chama.name}
              </span>
            </button>
          ))}

        {/* Co-members */}
        {coMembers.map((member: any) => {
          const displayName =
            member.full_name ||
            `${member.first_name || ""} ${member.last_name || ""}`.trim();
          const firstName =
            member.full_name?.split(" ")[0] || member.first_name || displayName;

          return (
            <button
              key={`member-${member.id}`}
              className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer"
              title={displayName}
              onClick={() => onMemberClick(member)}
            >
              <div className="w-10 h-10 rounded-full bg-[#2e856e] flex items-center justify-center text-white font-semibold text-xs group-hover:bg-[#083232] transition-colors">
                {firstName.charAt(0).toUpperCase()}
              </div>
              <span className="text-[10px] text-gray-700 font-medium max-w-[56px] truncate text-center leading-tight">
                {firstName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
