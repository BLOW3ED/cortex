import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

// Base: shadcn/ui (new-york v4). Chip de consola: mono, MAYÚSCULAS, esquinas casi rectas.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium tracking-[0.08em] uppercase whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-2 text-ink-2",
        brand: "border-transparent bg-brand text-brand-ink",
        xp: "border-transparent bg-xp text-xp-ink",
        streak: "border-transparent bg-streak text-streak-ink",
        outline: "border-border-strong text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant = "default", ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
