import Image from "next/image";

export function Logo({ variant = "branca", className = "h-8 w-auto" }: { variant?: "branca" | "escura"; className?: string }) {
  return <Image src={`/brand/logo-${variant}.svg`} alt="G4" width={120} height={32} className={className} priority />;
}
