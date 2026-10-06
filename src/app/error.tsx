"use client";
export default function ErrorPage({ reset }: {
    reset: () => void;
}) {
    return (<main className="error-page">
      <h1>Let’s try that again.</h1>
      <p>
        Something interrupted the workspace. Your saved records are still in the
        database.
      </p>
      <button className="button primary" onClick={reset}>
        Reload workspace
      </button>
    </main>);
}
