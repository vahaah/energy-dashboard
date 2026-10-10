import { Card } from "@/components/ui/card";

export function SiteFaq({
  items,
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  return (
    <section>
      <h2 className="text-heading-24 text-gray-1000">Questions</h2>
      <Card className="mt-4">
        <dl className="divide-y divide-gray-alpha-400">
          {items.map((faq) => (
            <div key={faq.question} className="py-4 first:pt-0 last:pb-0">
              <dt className="text-heading-16 text-gray-1000">{faq.question}</dt>
              <dd className="mt-1 text-copy-14 text-gray-900">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}
