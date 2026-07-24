import logo from "@/assets/logo.png";

export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={logo}
      alt="Memlace"
      width={size}
      height={size}
      className={"rounded-[6px] shrink-0 " + className}
      style={{ width: size, height: size }}
    />
  );
}
