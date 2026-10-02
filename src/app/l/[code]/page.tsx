import type { Metadata } from "next";
import { JoinByLink } from "@/components/join-by-link";

export const metadata: Metadata = { title: "Rejoindre une liste · Panier" };

export default async function JoinPage({ params }: PageProps<"/l/[code]">) {
  const { code } = await params;
  return <JoinByLink code={code} />;
}
