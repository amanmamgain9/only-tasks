import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

export default function MarketingHeader() {
  return (
    <nav className="flex min-w-full flex-wrap items-center justify-between rounded-lg p-4">
      <div className="order-1 flex items-center">
        <Link href="/" className="flex items-center">
          <div className="relative h-10 w-10 overflow-hidden">
            <Image
              src="/media/plan-my-workday/logo.jpg"
              alt="PlanMyWorkday logo"
              fill
              sizes="40px"
              className="rounded-full object-cover"
              priority
            />
          </div>
          <span className="ml-2 hidden text-lg font-medium text-primary sm:inline">PlanMyWorkday</span>
        </Link>
      </div>

      <div className="order-2 hidden items-center space-x-8 md:flex">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} className="rounded px-2 py-1 text-muted-foreground transition hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </div>

      <div className="order-3 flex items-center space-x-3">
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <Link
          href="/sign-in?next=/app/workspace/all-tasks"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Sign In
        </Link>
        <Link
          href="/app/workspace/all-tasks"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Open App
        </Link>
      </div>
    </nav>
  );
}
