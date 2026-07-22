import Image from "next/image";

export function Logo({ variant = "dark", className = "h-8 w-auto" }: { variant?: "dark" | "light"; className?: string }) {
  const src = variant === "dark" ? "/brand/Sequor_Logo_Dark.svg" : "/brand/Sequor_Logo_Light.svg";
  return <Image src={src} alt="Sequor Digital Solutions" width={1364} height={344} className={className} priority />;
}
