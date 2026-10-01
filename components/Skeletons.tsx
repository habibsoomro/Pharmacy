/**
 * Grey placeholder shapes shown while a page or card is loading, so slow
 * connections show the layout straight away instead of a blank screen.
 * No hooks: usable from server "loading" pages and client components alike.
 */

function Bar({ w = "w-full", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded-md bg-line/70`} />;
}

/** One card: icon + heading, then a few lines of text. */
export function CardSkeleton({ lines = 3, tall = false }: { lines?: number; tall?: boolean }) {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-2 border-b border-line/70 px-4 py-3">
        <div className="size-6 rounded-full bg-line/70" />
        <Bar w="w-40" h="h-5" />
      </div>
      <div className="space-y-3 p-4">
        {tall && <div className="grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-line/50" />)}</div>}
        {Array.from({ length: lines }, (_, i) => <Bar key={i} w={i % 3 === 2 ? "w-2/3" : "w-full"} />)}
      </div>
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6" aria-busy="true">
      <div className="animate-pulse space-y-3">
        <Bar w="w-3/4" h="h-8" />
        <div className="h-16 rounded-xl bg-line/50" />
      </div>
      <CardSkeleton lines={2} />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={4} tall />
      <CardSkeleton lines={4} tall />
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6" aria-busy="true">
      <div className="animate-pulse space-y-3">
        <Bar w="w-2/3" h="h-8" />
        <Bar />
        <div className="h-12 rounded-xl bg-line/50" />
      </div>
      <CardSkeleton lines={5} />
      <CardSkeleton lines={5} />
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 pt-8" aria-busy="true">
      <div className="animate-pulse"><Bar w="w-1/2" h="h-8" /></div>
      {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-card" />)}
    </div>
  );
}
