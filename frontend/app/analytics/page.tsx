'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AnalyticsPage() {
  return (
    <div className="h-full overflow-auto p-4 lg:p-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Network Analytics</CardTitle>
          <CardDescription>
            Detailed analytics and trend reporting will live here. The page is being rebuilt on top of the
            new device-level link data—stay tuned!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            In the meantime, you can continue using the Status and Settings pages to monitor live health and
            manage your topology. Analytics will surface historical uptime, latency, and utilization trends once complete.
          </p>
          <p className="text-xs">
            Looking for something specific? Let us know and we can prioritize it for the next iteration.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
