import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import { useLocation } from "wouter";
import badgerLogo from "@assets/Badger-Logo-2023-proposed_1770453144754.png";

export default function Login() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center mb-4">
            <img src={badgerLogo} alt="Badger" className="h-12" data-testid="img-login-logo" />
          </div>
          <CardTitle className="text-2xl font-display font-bold">Dispatch</CardTitle>
          <CardDescription>
            Scheduling Management System
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full h-12 text-base font-semibold" 
            onClick={handleLogin}
          >
            Log in with Replit
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
