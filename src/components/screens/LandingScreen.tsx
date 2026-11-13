"use client";

import { Button } from "@/components/ui/button";

interface LandingScreenProps {
  onContinue: () => void;
}

export function LandingScreen({ onContinue }: LandingScreenProps) {
  return (
    <div className="mx-auto w-full max-w-[1512px] px-4 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-[72px] lg:pt-[84px]">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,700px)_minmax(320px,1fr)] lg:gap-6">
        <div className="max-w-[700px] lg:pt-12">
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#006b50]">
            Wallet Maximizer
          </p>
          <h1 className="mt-5 max-w-[700px] text-[2.6rem] font-bold leading-[1.1] tracking-[-0.025em] text-balance text-[#102b43] sm:text-[3.4rem] lg:text-[4.25rem]">
            Find the right credit cards for you.
          </h1>
          <p className="mt-6 max-w-[650px] text-lg leading-[1.5] text-[#506578] sm:text-[20px]">
            Get a personalized credit card setup based on the cards you have,
            how you spend, and the benefits you value.
          </p>
          <div className="mt-7">
            <Button
              type="button"
              className="h-[62px] w-[224px] rounded-[13px] text-[18px] font-bold shadow-[0_4px_6px_rgba(0,107,80,0.14)]"
              onClick={onContinue}
            >
              Get started
            </Button>
            <p className="mt-4 max-w-[600px] text-[13px] leading-[1.5] text-[#506578]">
              Estimates from your answers. Not an offer from a card issuer, and
              not financial advice.
            </p>
          </div>
        </div>
        <HeroArt />
      </div>
    </div>
  );
}

function HeroArt() {
  return (
    <div className="relative mx-auto aspect-[600/520] w-full max-w-[640px]">
      <img
        src="/figma/home/backdrop.svg"
        alt=""
        className="pointer-events-none absolute top-0 left-[8%] h-[92%] w-auto max-w-none"
      />
      <FanCard
        className="top-[2%] left-[2%] z-10 w-[62%] -rotate-[13deg]"
        card="/figma/home/navy-card.svg"
        shadow="/figma/home/navy-shadow.svg"
        pattern="/figma/home/navy-pattern.svg"
        chip="/figma/home/navy-chip.svg"
        contactless="/figma/home/navy-contactless.svg"
        pay="/figma/home/navy-pay.svg"
        payClassName="top-[12%] right-[8%]"
      />
      <FanCard
        className="top-[22%] left-[16%] z-20 w-[58%] -rotate-[4deg]"
        card="/figma/home/mint-card.svg"
        shadow="/figma/home/mint-shadow.svg"
        pattern="/figma/home/mint-pattern.svg"
        chip="/figma/home/mint-chip.svg"
        contactless="/figma/home/mint-contactless.svg"
        pay="/figma/home/mint-pay.svg"
        payClassName="top-[14%] right-[8%]"
      />
      <FanCard
        className="top-[40%] left-[24%] z-30 w-[62%] rotate-[9deg]"
        card="/figma/home/emerald-card.svg"
        shadow="/figma/home/emerald-shadow.svg"
        pattern="/figma/home/emerald-pattern.svg"
        chip="/figma/home/emerald-chip.svg"
        contactless="/figma/home/emerald-contactless.svg"
        pay="/figma/home/emerald-pay.svg"
        payClassName="right-[10%] bottom-[12%]"
      />
    </div>
  );
}

function FanCard({
  className,
  card,
  shadow,
  pattern,
  chip,
  contactless,
  pay,
  payClassName,
}: {
  className: string;
  card: string;
  shadow: string;
  pattern: string;
  chip: string;
  contactless: string;
  pay: string;
  payClassName: string;
}) {
  return (
    <div className={`absolute ${className}`}>
      <img
        src={shadow}
        alt=""
        className="pointer-events-none absolute -inset-[4%] h-[108%] w-[108%] max-w-none"
      />
      <img src={card} alt="" className="relative block h-auto w-full" />
      <img
        src={pattern}
        alt=""
        className="pointer-events-none absolute top-[8%] right-0 h-[62%] w-[48%]"
      />
      <img
        src={chip}
        alt=""
        className="pointer-events-none absolute top-[14%] left-[8%] h-[14%] w-auto"
      />
      <img
        src={contactless}
        alt=""
        className="pointer-events-none absolute top-[16%] left-[24%] h-[12%] w-auto"
      />
      <img
        src={pay}
        alt=""
        className={`pointer-events-none absolute h-[12%] w-auto ${payClassName}`}
      />
    </div>
  );
}
