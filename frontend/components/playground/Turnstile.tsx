"use client";

import Script from "next/script";
import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export type TurnstileHandle = { token: () => string | null; reset: () => void };

/**
 * Cloudflare Turnstile bot check. Usually invisible; shows a checkbox only if Cloudflare is unsure.
 * Rendered only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export function Turnstile({ ref }: { ref: Ref<TurnstileHandle> }) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);

  const render = useCallback(() => {
    if (!TURNSTILE_SITE_KEY || !box.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(box.current, {
      sitekey: TURNSTILE_SITE_KEY,
      appearance: "interaction-only",
      callback: (t: string) => (token.current = t),
      "expired-callback": () => (token.current = null),
      "error-callback": () => (token.current = null),
    });
  }, []);

  useEffect(() => {
    render();
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [render]);

  useImperativeHandle(ref, () => ({
    token: () => token.current,
    reset: () => {
      token.current = null;
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render} />
      <div ref={box} className="flex justify-center" />
    </>
  );
}
