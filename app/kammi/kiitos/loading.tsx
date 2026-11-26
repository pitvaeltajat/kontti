import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function KammiThanksLoading() {
  return (
    <div className="container flex justify-center py-12" aria-busy="true">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-6 w-56 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-3/4 max-w-sm" />
          <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
    </div>
  );
}
