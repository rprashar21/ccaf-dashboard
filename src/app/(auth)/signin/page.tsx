import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Footer, Nav } from "@/components/Nav";
import { safeCallback } from "@/lib/callback";

export const metadata: Metadata = { title: "Sign in" };

// GitHub and Google with the same email is the likeliest support ticket, so
// name that case rather than showing a raw error code.
const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email is already registered with the other provider. Sign in the way you did the first time.",
  AccessDenied: "That sign-in was declined. Try again, or use the other provider.",
  Configuration: "Sign-in is misconfigured on this deployment. Nothing you did caused this.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;

  if (session?.user) redirect(callbackUrl ?? "/dashboard");

  const target = safeCallback(callbackUrl);

  async function authenticate(formData: FormData) {
    "use server";
    const provider = formData.get("provider");
    if (provider !== "github" && provider !== "google") return;
    await signIn(provider, { redirectTo: target });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <span className="tick">Sign in</span>
        <h1 className="font-display mt-3 text-3xl">Pick up where you left off</h1>
        <p className="text-graphite mt-3">
          No password. We store your name, email, and avatar from the provider, plus the questions
          you answer.
        </p>

        {error ? (
          <p className="border-under bg-under-soft text-ink mt-6 rounded-md border px-4 py-3 text-sm">
            {ERRORS[error] ?? "Sign-in did not complete. Try again."}
          </p>
        ) : null}

        <div className="mt-8 space-y-3">
          <form action={authenticate}>
            <input type="hidden" name="provider" value="github" />
            <button
              type="submit"
              className="bg-ink hover:bg-ink/90 w-full rounded-md px-4 py-3 font-semibold text-white"
            >
              Continue with GitHub
            </button>
          </form>

          <form action={authenticate}>
            <input type="hidden" name="provider" value="google" />
            <button
              type="submit"
              className="border-hairline bg-raise hover:border-graphite w-full rounded-md border px-4 py-3 font-semibold"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
