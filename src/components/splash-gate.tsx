"use client";

import { useEffect, useState } from "react";
import Login from "./login";
import SplashScreen from "./splash-screen";

const SPLASH_DURATION_MS = 1000;
const FADE_DURATION_MS = 300;

export default function SplashGate() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let animationFrame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const nextProgress = Math.min(100, (elapsed / SPLASH_DURATION_MS) * 100);
      setProgress(nextProgress);

      if (elapsed < SPLASH_DURATION_MS) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        setProgress(100);
        setExiting(true);
      }
    };

    animationFrame = requestAnimationFrame(tick);
    const hideTimer = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS + FADE_DURATION_MS);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      <div className={visible ? "ms-login-ready" : "ms-login-ready is-visible"} aria-hidden={visible}>
        <Login />
      </div>
      {visible && <SplashScreen progress={progress} exiting={exiting} />}
    </>
  );
}