import { Skeleton } from '@/components/ui/skeleton';

/** Neutral loading placeholder for admin form routes (title + a few fields). */
export function FormSkeleton() {
  return (
    <div aria-busy="true">
      <div className="mb-6">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
