export const dynamic = "force-static";
export const revalidate = 0;

import ModuleAPageClient from "./page.client";

export default function ModuleAPage() {
  return <ModuleAPageClient />;
}
