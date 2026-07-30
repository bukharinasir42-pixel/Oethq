import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type FeatureListProps = {
  items: string[];
  columns?: 1 | 2 | 3;
};

export function FeatureList({ items, columns = 2 }: FeatureListProps) {
  const gridClass =
    columns === 3 ? "md:grid-cols-2 xl:grid-cols-3" : columns === 2 ? "md:grid-cols-2" : "grid-cols-1";

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {items.map((item) => (
        <Card key={item}>
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
            <p className="text-foreground">{item}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
