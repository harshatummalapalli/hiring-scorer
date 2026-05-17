import Image from "next/image";
import { KARTA, karta } from "@/lib/brand/karta";

type AuthCardProps = {
  children: React.ReactNode;
};

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/icon.svg"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12"
            priority
          />
          <p className="mt-4 text-2xl font-semibold tracking-tight text-[#1E293B]">
            {KARTA.name}
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#64748B]">
            {KARTA.tagline}
          </p>
        </div>
        <div className={`${karta.card} p-8`}>{children}</div>
      </div>
    </div>
  );
}
