import Image from "next/image";
import { productConfig } from "@/config/product";

export function Brand({ name = productConfig.name }: { name?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-3" dir="ltr">
      <Image
        src="/brand/scanvoro-mark.svg"
        alt=""
        width={32}
        height={32}
        className="shrink-0"
      />
      <span className="min-w-0 text-lg font-semibold leading-snug">{name}</span>
    </span>
  );
}
