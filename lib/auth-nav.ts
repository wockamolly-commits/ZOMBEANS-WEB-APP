type NamedProfile = {
  display_name: string;
};

export type AuthNavState = {
  href: string;
  label: string;
  ariaLabel: string;
};

export function resolveAuthNavState({
  operationsProfile,
  riderProfile,
  hasCustomerUser,
}: {
  operationsProfile: NamedProfile | null;
  riderProfile: NamedProfile | null;
  hasCustomerUser: boolean;
}): AuthNavState {
  if (operationsProfile) {
    return {
      href: "/workspace",
      label: "Dashboard",
      ariaLabel: `Dashboard: ${operationsProfile.display_name}`,
    };
  }

  if (riderProfile) {
    return {
      href: "/rider",
      label: "Rider",
      ariaLabel: `Rider dashboard: ${riderProfile.display_name}`,
    };
  }

  if (hasCustomerUser) {
    return {
      href: "/account",
      label: "Account",
      ariaLabel: "Account",
    };
  }

  return {
    href: "/login",
    label: "Sign in",
    ariaLabel: "Sign in",
  };
}
