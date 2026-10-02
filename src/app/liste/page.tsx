import type { Metadata } from "next";
import { ShoppingListView } from "@/components/list/shopping-list-view";

export const metadata: Metadata = { title: "Ma liste · Panier" };

export default function ListPage() {
  return <ShoppingListView />;
}
