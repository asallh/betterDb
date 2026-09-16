import { useEffect, useState } from "react";

function readIsDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * Tracks whether the app is currently in dark mode by observing the `dark`
 * class that App.tsx toggles on the document element in response to the
 * system color scheme.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(readIsDark()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
