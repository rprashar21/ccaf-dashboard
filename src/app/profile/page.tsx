import type { Metadata } from "next";
import Link from "next/link";
import { Footer, Nav } from "@/components/Nav";
import { getGuestUserId } from "@/lib/guest";
import { getProfileData } from "@/server/queries/profile";
import { CertProgressCard } from "./_components/CertProgressCard";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const userId = await getGuestUserId();
  const data = await getProfileData(userId);

  const firstName = data.user.name?.split(" ")[0] ?? "there";
  const memberSince = data.user.createdAt.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Nav signedIn />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="tick">Profile</span>
            <h1 className="font-display mt-2 text-3xl">{firstName}&rsquo;s progress</h1>
            <p className="text-graphite mt-2 text-sm">Member since {memberSince}</p>
          </div>

          {data.streak.current > 0 ? (
            <div className="border-hairline bg-raise rounded-lg border px-5 py-4 text-right">
              <p className="tabular text-3xl font-bold">{data.streak.current}</p>
              <p className="text-graphite text-sm">
                day{data.streak.current === 1 ? "" : "s"} running · longest {data.streak.longest}
              </p>
            </div>
          ) : null}
        </div>

        {data.certifications.length === 0 ? (
          <section className="border-hairline bg-raise mt-10 rounded-lg border p-8">
            <span className="tick">Nothing yet</span>
            <h2 className="font-display mt-3 text-2xl">
              You haven&rsquo;t started a certification
            </h2>
            <p className="text-graphite mt-3 max-w-xl">
              Take your first practice set and your progress will show up here.
            </p>
            <div className="mt-6">
              <Link
                href="/c/cca-f"
                className="bg-gate hover:bg-gate/90 rounded-md px-4 py-2 text-sm font-semibold text-white"
              >
                Browse CCA-F
              </Link>
            </div>
          </section>
        ) : (
          <div className="mt-10 space-y-8">
            {data.certifications.map((summary) => (
              <CertProgressCard key={summary.certification.id} summary={summary} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
