import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  History,
  Mail,
  ShieldCheck,
  UserRound,
  ClipboardList,
} from "lucide-react";
import { RiderProfileForm } from "@/components/rider/RiderProfileForm";
import { requireRider } from "@/lib/rider";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rider profile" };

function formatDate(value: string | undefined): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export default async function RiderProfilePage() {
  const { user, profile } = await requireRider("/rider/profile");
  const supabase = await createAdminSessionClient();
  const [activeResult, completedResult] = await Promise.all([
    supabase
      .from("rider_assignments")
      .select("order_id", { count: "exact", head: true })
      .eq("rider_profile_id", profile.id)
      .is("delivered_at", null),
    supabase
      .from("rider_assignments")
      .select("order_id", { count: "exact", head: true })
      .eq("rider_profile_id", profile.id)
      .not("delivered_at", "is", null),
  ]);

  return (
    <div className="space-y-5">
      <Link
        href="/rider"
        className="inline-flex items-center gap-2 text-sm font-medium text-zb-cream/60 transition hover:text-zb-bone"
      >
        <ArrowLeft className="size-4" />
        Back to deliveries
      </Link>

      <section className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zb-bone/10 text-zb-bone">
            <UserRound className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zb-bone">
              Rider profile
            </p>
            <h1 className="mt-1 font-display text-3xl leading-none text-zb-cream">
              {profile.display_name}
            </h1>
            <p className="mt-1 text-sm text-zb-cream/55">
              Manage the name and account details used across rider pages.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <ProfileMeta icon={Mail} label="Email" value={user.email ?? "No email"} />
          <ProfileMeta icon={ShieldCheck} label="Access" value="Rider" />
          <ProfileMeta icon={Bike} label="Member since" value={formatDate(user.created_at)} />
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        <Stat
          icon={ClipboardList}
          label="Active assignments"
          value={String(activeResult.count ?? 0)}
        />
        <Stat
          icon={History}
          label="Completed deliveries"
          value={String(completedResult.count ?? 0)}
        />
      </section>

      <section className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4 sm:p-5">
        <div className="mb-5 border-b border-zb-sage/15 pb-4">
          <h2 className="font-display text-2xl text-zb-cream">PROFILE DETAILS</h2>
          <p className="mt-1 text-sm text-zb-cream/55">
            Updates appear in your rider dashboard after saving.
          </p>
        </div>
        <RiderProfileForm
          initial={{
            display_name: profile.display_name,
            full_name: profile.full_name,
          }}
        />
      </section>
    </div>
  );
}

function ProfileMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <p className="flex min-w-0 items-start gap-2 rounded-lg bg-zb-primary/35 px-3 py-2 text-sm text-zb-cream/65">
      <Icon className="mt-0.5 size-4 shrink-0 text-zb-sage" />
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/35">
          {label}
        </span>
        <span className="block truncate">{value}</span>
      </span>
    </p>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zb-sage/20 bg-zb-primary-strong/55 p-4">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zb-cream/45">
        <Icon className="size-4 text-zb-bone" />
        {label}
      </p>
      <p className="mt-2 font-mono-tabular text-3xl font-bold text-zb-cream">
        {value}
      </p>
    </div>
  );
}
