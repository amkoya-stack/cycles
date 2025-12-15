import Link from "next/link";

interface HomeHeaderProps {
  isAuthenticated: boolean;
}

export function HomeHeader({ isAuthenticated }: HomeHeaderProps) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-4xl font-bold text-[#083232]">
        #1 social fintech in kenya
      </h1>
      <h3 className="text-lg text-gray-600 mt-1">
        browse or{" "}
        {isAuthenticated ? (
          <Link
            href="/cycle/create"
            className="text-[#083232] hover:text-[#2e856e] font-semibold underline decoration-2 underline-offset-2 transition-colors"
          >
            create a cycle
          </Link>
        ) : (
          <Link
            href="/auth/login"
            className="text-[#083232] hover:text-[#2e856e] font-semibold underline decoration-2 underline-offset-2 transition-colors"
          >
            create a cycle
          </Link>
        )}
      </h3>
    </div>
  );
}
