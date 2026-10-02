import { renderAppIcon } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS arrondit lui-même les coins : icône pleine.
export default function AppleIcon() {
  return renderAppIcon(180, { padding: 0.2 });
}
