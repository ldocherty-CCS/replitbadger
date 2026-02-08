import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  Users, 
  Truck, 
  LogOut, 
  Menu,
  MapPin,
  ShieldCheck,
  BarChart3
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import badgerLogo from "@assets/Badger-Logo-2023-proposed_1770453144754.png";

export function Navigation() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/", label: "Schedule", icon: CalendarDays },
    { href: "/operators", label: "Operators", icon: Truck },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/oq", label: "Qualifications", icon: ShieldCheck },
    { href: "/map", label: "Map", icon: MapPin },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  if (!user) return null;

  return (
    <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50" data-testid="navigation-bar">
      <div className="flex h-14 items-center px-4 gap-6">
        <Link href="/" className="flex items-center shrink-0">
          <img src={badgerLogo} alt="Badger" className="h-10 hidden sm:block" data-testid="img-badger-logo" />
          <img src={badgerLogo} alt="Badger" className="h-8 sm:hidden" data-testid="img-badger-logo-mobile" />
        </Link>

        <div className="hidden md:flex items-center gap-0.5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                location === item.href 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover-elevate"
              )} data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground" data-testid="text-user-name">
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.username || user.email || "User"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => logout()} title="Sign Out" data-testid="button-logout">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col space-y-1 mt-6">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                      location === item.href 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover-elevate"
                    )}>
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </div>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
