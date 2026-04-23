import { Suspense } from "react";
import SignInScreen from "@/features/auth/components/SignInScreen";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInScreen />
    </Suspense>
  );
}
