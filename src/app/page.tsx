import { getContentIndex } from "@/content/server";
import { APP_NAME } from "@/lib/app";

export default function HomePage() {
  const index = getContentIndex();
  const withContent = index.subjects.filter((s) => s.hasContent);
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <ul>
        {withContent.map((s) => (
          <li key={s.id}>
            {s.name} · {s.unitCount} {s.unitCount === 1 ? "unidad" : "unidades"}
          </li>
        ))}
      </ul>
    </main>
  );
}
