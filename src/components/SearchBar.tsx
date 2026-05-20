"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchBar({ initial }: { initial: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp);
    if (v) params.set("q", v);
    else params.delete("q");
    start(() => {
      router.replace(`/?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={submit}>
      <input
        type="search"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Search messages, titles, prompts, branches…"
        className="w-full rounded border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm outline-none focus:border-white/30"
      />
      {pending && <div className="mt-1 text-[10px] text-white/40">searching…</div>}
    </form>
  );
}
