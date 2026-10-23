export function FaqList({
  items,
}: {
  items: readonly { question: string; answer: string }[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="questions">
      <h2 id="questions" className="text-heading-24 text-gray-1000">
        Questions
      </h2>
      <dl className="mt-4 flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.question}>
            <dt className="text-copy-16 text-gray-1000">{item.question}</dt>
            <dd className="mt-1 max-w-3xl text-copy-14 text-gray-900">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
