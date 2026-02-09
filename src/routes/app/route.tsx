import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/tanstack-react-start";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isDeckEditingView = /^\/app\/decks\/[^/]+\/edit(?:\/card\/[^/]+)?$/.test(pathname);

  return (
    <>
      <SignedOut>
        <div className="mx-auto mt-20 max-w-md rounded-xl border p-6 text-center">
          <h1 className="text-xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is for authenticated deck management.
          </p>
          <div className="mt-4">
            <SignInButton mode="modal">
              <Button>Sign In</Button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="min-h-screen bg-background">
          {!isDeckEditingView && (
            <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
              <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4">
                <nav className="flex items-center gap-3">
                  <Link to="/" className="text-xl font-semibold tracking-tight">
                    Remora
                  </Link>
                  <Link to="/app/decks" className="text-sm text-muted-foreground hover:text-foreground">
                    Decks
                  </Link>
                </nav>
                <UserButton />
              </div>
            </header>
          )}
          <Outlet />
        </div>
      </SignedIn>
    </>
  );
}
