import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuth } from "@/hooks/useAuth";

export function UserManagement() {
  const { user } = useAuth();
  
  if (!user) {
    return <EmptyState icon={Users} title="Not authenticated" description="Please log in first." />;
  }
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Current User</CardTitle>
          <CardDescription>User management features coming soon.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{user.email}</span>
            <Badge className="text-xs bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
              {user.role}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </CardContent>
      </Card>
    </div>
  );
}
