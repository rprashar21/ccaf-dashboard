import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-baseline gap-2">
      <span className="font-display text-ink text-lg">Readiness</span>
      <span className="tick hidden sm:inline">CCA-F</span>
    </Link>
  );
}

export function Nav({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="border-hairline border-b">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Logo />
        <div className="flex items-center gap-6">
          {signedIn ? (
            <>
              <Link href="/dashboard" className="text-graphite hover:text-ink text-sm">
                Dashboard
              </Link>
              <Link href="/c/cca-f/practice" className="text-graphite hover:text-ink text-sm">
                Practice
              </Link>
            </>
          ) : (
            <>
              <Link
                href="#how-it-works"
                className="text-graphite hover:text-ink hidden text-sm sm:inline"
              >
                How it works
              </Link>
              <Link
                href="#domains"
                className="text-graphite hover:text-ink hidden text-sm sm:inline"
              >
                Exam domains
              </Link>
              <Link
                href="/signin"
                className="bg-gate hover:bg-gate/90 rounded-md px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-hairline mt-24 border-t">
      <div className="text-graphite mx-auto max-w-5xl space-y-3 px-6 py-10 text-sm">
        <p>
          <span className="text-ink font-semibold">Readiness</span> is an independent study tool. It
          is not affiliated with, endorsed by, or produced by Anthropic.
        </p>
        <p>
          Exam format and domain weights are taken from a third-party prep guide, not from published
          Anthropic material. Verify them against official certification documentation before
          relying on them.
        </p>
      </div>
    </footer>
  );
}
