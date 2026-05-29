import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border py-16">
      <div className="mx-auto max-w-7xl px-6 grid gap-12 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-ember text-ember-foreground shadow-ember">
              <Flame className="h-4 w-4" />
            </span>
            IdeaForge
          </Link>
          <p className="mt-4 text-xs text-muted-foreground max-w-xs">
            Concept to market, in one flow.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            { label: "How it works", href: "/#flow" },
            { label: "Showcase", href: "/#showcase" },
            { label: "Pricing", href: "/#pricing" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { label: "Contact", to: "/contact" },
            { label: "Dashboard", to: "/dashboard" },
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            { label: "Sign in", to: "/auth" },
            { label: "Start forging", to: "/auth" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-7xl px-6 mt-12 text-xs text-muted-foreground">
        © {new Date().getFullYear()} IdeaForge Labs.
      </div>
    </footer>
  );
}

type Item = { label: string; href?: string; to?: string };

function FooterCol({ title, links }: { title: string; links: Item[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-foreground">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="text-muted-foreground hover:text-foreground transition">
                {l.label}
              </Link>
            ) : (
              <a href={l.href} className="text-muted-foreground hover:text-foreground transition">
                {l.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
