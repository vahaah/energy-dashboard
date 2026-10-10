import type { ReactNode } from "react";
import { Card, type CardProps } from "@/components/ui/card";

export function SectionBlock({
  headerRight,
  actions,
  ...props
}: CardProps & { headerRight?: ReactNode }) {
  return <Card {...props} actions={actions ?? headerRight} />;
}
