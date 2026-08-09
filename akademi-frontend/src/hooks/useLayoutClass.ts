import { useWindowDimensions } from "react-native";
import { breakpoint } from "../theme/foundations";

export type LayoutClass = "compact" | "medium" | "expanded" | "large" | "extraLarge";

export function getLayoutClass(width: number): LayoutClass {
  if (width < breakpoint.medium) return "compact";
  if (width < breakpoint.expanded) return "medium";
  if (width < breakpoint.large) return "expanded";
  if (width < breakpoint.extraLarge) return "large";
  return "extraLarge";
}

export function useLayoutClass() {
  const dimensions = useWindowDimensions();
  const layoutClass = getLayoutClass(dimensions.width);

  return {
    ...dimensions,
    layoutClass,
    isCompact: layoutClass === "compact",
    isMedium: layoutClass === "medium",
    isExpanded: ["expanded", "large", "extraLarge"].includes(layoutClass),
  };
}
