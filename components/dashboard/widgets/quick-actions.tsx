import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"
import Link from "next/link"

interface QuickAction {
  title: string
  description: string
  href: string
  icon: LucideIcon
  variant?: "default" | "secondary" | "outline"
}

interface QuickActionsProps {
  title: string
  actions: QuickAction[]
}

export function QuickActions({ title, actions }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || "outline"}
            className="w-full justify-start h-auto p-4"
            asChild
          >
            <Link href={action.href}>
              <div className="flex items-center gap-3">
                <action.icon className="h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{action.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {action.description}
                  </div>
                </div>
              </div>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}