export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Clerkbook</h1>
      <p className="mt-2 text-sm text-gray-600">
        Citation-first research library (save → summarize → search → cite).
      </p>

      <div className="mt-6 space-y-3">
        <a className="underline" href="/new">New item</a>
        <br />
        <a className="underline" href="/library">Library</a>
      </div>

      <p className="mt-8 text-xs text-gray-500">
        Scaffold only — auth + capture + jobs coming next.
      </p>
    </main>
  );
}
