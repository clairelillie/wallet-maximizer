import { Mail, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { CatalogBrowser } from "@/components/screens/CatalogBrowser";
import { SUPPORT_EMAIL } from "@/lib/site";

export function AboutScreen() {
  return (
    <>
      <main className="px-4 py-6 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              About
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              A planning tool for a wallet you can keep.
            </h1>
          </header>

          <section className="rounded-2xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-10">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Our mission
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Wallet Maximizer exists to make confusing credit card decisions
                simple, based on how you already spend.
              </p>
              <p>
                A useful wallet is usually three to five cards, not a drawer
                full of plastic. You should know which card to pull out, which
                annual fees are paying for themselves, and which cards are only
                adding noise. We start from the cards you already carry, the
                categories you actually spend in, and the kind of rewards you
                want to earn.
              </p>
              <p>
                The result is an intentional stack: clear roles, less overlap,
                and a straight answer at checkout. We are here to help you
                choose a wallet you can keep using, with a small set of cards,
                rules you can remember, and fees that earn their place.
              </p>
            </div>
          </section>

          <CatalogBrowser />

          <section className="rounded-2xl border border-amber-200/20 bg-amber-200/10 px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
              <div className="min-w-0 space-y-3">
                <h2 className="text-base font-semibold tracking-tight text-amber-50">
                  Check every suggestion yourself
                </h2>
                <div className="space-y-3 text-sm leading-relaxed text-amber-50/90">
                  <p>
                    Wallet Maximizer is a planning aid. It is not financial,
                    tax, or credit advice, and it is not an offer from any card
                    issuer. Suggestions are estimates. Rewards rates, credits,
                    annual fees, and welcome offers change, and the value you
                    actually get depends on how you spend and redeem.
                  </p>
                  <p>
                    Check every suggestion on your own before you apply, keep,
                    product-change, or cancel a card. Compare it with the
                    issuer’s current terms and with your own accounts. You are
                    responsible for confirming that a suggestion is right for
                    you.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div className="min-w-0 space-y-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Support
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Questions about the app, a card that looks wrong, or a
                  suggestion that does not match your spending? Email us.
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-block max-w-full break-words text-base font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </section>

          <p className="text-center">
            <Link
              href="/"
              className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              Back to Wallet Maximizer
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
