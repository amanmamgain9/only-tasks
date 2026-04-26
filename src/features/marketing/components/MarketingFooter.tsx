import Link from "next/link";

const resourceLinks = [
  { href: "/alternatives", label: "Alternatives" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/features", label: "Features" },
  { href: "/use-case", label: "Use Cases" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 py-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">PlanMyWorkday</p>
          <p className="mt-1 text-sm text-slate-600">Keyboard-first task management for fast planning and focused work.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          {resourceLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-slate-950">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
