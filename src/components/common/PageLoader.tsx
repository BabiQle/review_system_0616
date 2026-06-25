import { Skeleton } from '@/components/ui/skeleton';

export default function PageLoader() {
  return (
    <div className="flex h-screen w-full">
      {/* 左侧侧边栏骨架 */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-sidebar p-4">
        <div className="flex items-center gap-2.5 mb-8">
          <Skeleton className="w-8 h-8 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-sidebar-border">
          <Skeleton className="h-10 w-full rounded" />
        </div>
      </aside>

      {/* 右侧内容区骨架 */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden border-b p-4">
          <Skeleton className="h-6 w-32" />
        </header>
        <main className="flex-1 p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </main>
      </div>
    </div>
  );
}