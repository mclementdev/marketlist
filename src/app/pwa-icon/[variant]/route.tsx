import { renderAppIcon } from "@/lib/app-icon";

const VARIANTS = {
  "192": () => renderAppIcon(192, { rounded: true, padding: 0.18 }),
  "512": () => renderAppIcon(512, { rounded: true, padding: 0.18 }),
  // Zone de sécurité « maskable » : le dessin tient dans le cercle central de 80 %.
  "maskable-512": () => renderAppIcon(512, { padding: 0.27 }),
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[variant]">) {
  const { variant } = await ctx.params;
  const render = VARIANTS[variant as keyof typeof VARIANTS];
  if (!render) return new Response("Not found", { status: 404 });
  return render();
}
