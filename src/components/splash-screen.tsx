import Image from "next/image";

export default function SplashScreen({ progress, exiting }: { progress: number; exiting: boolean }) {
  const roundedProgress = Math.round(progress);

  return (
    <main className={exiting ? "ms-splash is-exiting" : "ms-splash"} aria-label="MindSpine is preparing your workspace">
      <Image
        src="/images/splash/mindspine-splash-clean-bg.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="ms-splash-bg"
      />
      <div className="ms-splash-overlay" aria-hidden="true" />
      <svg className="ms-splash-curve" viewBox="0 0 760 720" aria-hidden="true">
        <path d="M491-24C456 75 506 139 617 207c164 101 133 281-93 389C396 657 360 700 353 751" />
      </svg>
      <section className="ms-splash-content" aria-live="polite">
        <div className="ms-splash-brand" aria-label="MindSpine, align heal move forward">
          <svg viewBox="0 0 40 48" aria-hidden="true">
            <path d="M20 3C8 9 5 22 9 34c2 6 6 10 11 11 5-1 9-5 11-11 4-12 1-25-11-31Z" />
            <path d="M20 11c-5 4 5 9 0 14s3 9 0 14" />
            <path d="m14 16 10 1m-9 5 10 1m-11 5 10 1m-8 5 8 1" />
          </svg>
          <h1>MindSpine</h1>
          <p>ALIGN · HEAL · MOVE FORWARD</p>
        </div>
        <div
          className="ms-splash-progress"
          role="progressbar"
          aria-label="Preparing your workspace"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedProgress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="ms-splash-status">Preparing your workspace...</p>
      </section>
    </main>
  );
}