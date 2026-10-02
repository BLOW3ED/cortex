import { buildStudyCatalog } from "@/content/core/study-catalog";
import { getContentIndex } from "@/content/server";

// Se genera en el build como archivo estático: el navegador lo pide una vez y lo guarda en caché.
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildStudyCatalog(getContentIndex()));
}
