import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

interface ActivityItem {
  id: string
  user: {
    name: string
    avatar?: string
  }
  action: string
  target: string
  timestamp: Date
  status?: "success" | "warning" | "error" | "info"
}

interface RecentActivityProps {
  title: string
  activities: ActivityItem[]
  maxItems?: number
}

export function RecentActivity({ title, activities, maxItems = 5 }: RecentActivityProps) {
  const displayedActivities = activities.slice(0, maxItems)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case "success": return "success"
      case "warning": return "warning"
      case "error": return "error"
      case "info": return "info"
      default: return "secondary"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayedActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        ) : (
          displayedActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={activity.user.avatar} />
                <AvatarFallback className="text-xs">
                  {getInitials(activity.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{activity.user.name}</span>
                    {" "}{activity.action}{" "}
                    <span className="font-medium">{activity.target}</span>
                  </p>
                  {activity.status && (
                    <Badge variant={getStatusVariant(activity.status)} className="text-xs">
                      {activity.status}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}