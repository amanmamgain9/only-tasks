import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/feature", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

export default function MarketingHeader() {
  return (
    <header className="flex flex-col gap-5 py-6 md:flex-row md:items-center md:justify-between">
      <Link href="/" className="flex items-center gap-3">
        <div className="relative h-11 w-11 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
          <Image src="/media/plan-my-workday/logo.jpg" alt="PlanMyWorkday logo" fill sizes="44px" className="object-cover" priority />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">PlanMyWorkday</p>
          <p className="text-sm font-medium text-slate-900">Task management that moves fast</p>
        </div>
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:gap-8">
        <nav className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-slate-950">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in?next=/app/workspace/all-tasks"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Sign In
          </Link>
          <Link
            href="/app/workspace/all-tasks"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Open App
          </Link>
        </div>
      </div>
    </header>
  );
}
