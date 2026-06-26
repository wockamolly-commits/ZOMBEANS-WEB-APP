import { MenuManager } from "@/components/admin/menu/MenuManager";
import { hasStaffPermission, requireStaffPermission } from "@/lib/admin";
import { getMenuManagementData } from "@/lib/menu-management";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu management" };

export default async function MenuManagementPage() {
  const { profile } = await requireStaffPermission("menu:view", "/workspace/menu");
  const data = await getMenuManagementData();
  const can = {
    configure: hasStaffPermission(profile, "menu:configure"),
    availability: hasStaffPermission(profile, "menu:availability"),
  };
  return <MenuManager initialData={data} can={can} />;
}
