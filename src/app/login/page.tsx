import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
