"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function NavigationLoading() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.remove("is-navigating");
  }, [pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a");

      if (!anchor) {
        return;
      }

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);

      if (destination.origin !== window.location.origin) {
        return;
      }

      if (destination.pathname === window.location.pathname) {
        return;
      }

      document.documentElement.classList.add("is-navigating");
    };

    const handlePopState = () => {
      document.documentElement.classList.add("is-navigating");
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}