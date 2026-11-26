import { Skeleton } from '@/components/ui/skeleton';

export default function CheckoutLoading() {
  return (
    <div className="container py-6 sm:py-8" aria-busy="true">
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="rounded-lg border bg-card p-4 shadow-sm">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="h-fit space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
