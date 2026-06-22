import { MenuManager } from "@/components/admin/menu/MenuManager";
import { requireSuperAdmin } from "@/lib/admin";
import { getMenuManagementData } from "@/lib/menu-management";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu management" };

export default async function MenuManagementPage() {
  await requireSuperAdmin("/workspace/menu");
  const data = await getMenuManagementData();
  return <MenuManager initialData={data} />;
}
