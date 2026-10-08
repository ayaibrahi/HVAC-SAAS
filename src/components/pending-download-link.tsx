"use client";

import { useState } from "react";

export function PendingDownloadLink({
  href,
  label,
  pendingLabel,
  className,
}: {
  href: string;
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const [isPending, setIsPending] = useState(false);

  return (
    <a
      href={href}
      className={className}
      aria-busy={isPending}
      onClick={() => {
        setIsPending(true);
      }}
    >
      {isPending ? pendingLabel : label}
    </a>
  );
}
