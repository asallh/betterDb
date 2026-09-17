import { brandIconSrcForVersion } from "../../../shared/version";
import { cn } from "@/lib/utils";

type AppBrandIconProps = {
  className?: string;
};

/** Icon PNGs reserve ~15% transparent margin for macOS; scale crops that for UI. */
const ICON_CONTENT_SCALE = 1.18;

export function AppBrandIcon({ className }: AppBrandIconProps) {
  const src = brandIconSrcForVersion(__APP_VERSION__, __APP_CHANNEL__);
  return (
    <span
      className={cn("inline-flex shrink-0 overflow-hidden", className)}
      aria-hidden
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="h-full w-full select-none"
        style={{ transform: `scale(${ICON_CONTENT_SCALE})` }}
      />
    </span>
  );
}
