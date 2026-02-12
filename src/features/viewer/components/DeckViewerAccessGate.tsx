import { SignedIn, SignedOut, SignInButton } from "@clerk/tanstack-react-start";
import { Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useDeckViewerAccessRequest } from "@/features/viewer/hooks/useDeckViewerAccessRequest";
import type { ViewerDeniedData } from "@/features/viewer/hooks/viewerTypes";
import type { Id } from "@/lib/convexApi";

type RequestAccessMutation = (args: { deckId: Id<"decks">; message?: string }) => Promise<unknown>;

type DeckViewerAccessGateProps = {
  data: ViewerDeniedData;
  deckId: string;
  requestStatus?: string;
  requestAccess: RequestAccessMutation;
};

export function DeckViewerAccessGate({
  data,
  deckId,
  requestStatus,
  requestAccess,
}: DeckViewerAccessGateProps) {
  const { requestMessage, setRequestMessage, requestError, requestingAccess, submitRequest } =
    useDeckViewerAccessRequest(deckId, requestAccess);

  const isRequestable = data.access === "whitelist_requestable" || requestStatus === "rejected";
  const isPending = data.access === "whitelist_pending" || requestStatus === "pending";

  return (
    <div className="mx-auto mt-20 max-w-xl px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> {data.deck.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {data.deck.description || "This deck has restricted access."}
          </p>

          {data.access === "private" && (
            <Badge variant="outline">Private deck: owner access only</Badge>
          )}

          {data.access === "whitelist_sign_in_required" && (
            <>
              <p className="text-sm">Sign in to request access.</p>
              <SignInButton mode="modal">
                <Button>
                  <ShieldCheck className="h-4 w-4" /> Sign In
                </Button>
              </SignInButton>
            </>
          )}

          {isRequestable ? (
            <SignedIn>
              <div className="space-y-2">
                <Textarea
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                  placeholder="Optional message to deck owner"
                />
                <Button disabled={requestingAccess} onClick={() => void submitRequest()}>
                  {requestingAccess ? "Requesting..." : "Request access"}
                </Button>
                {requestError ? <p className="text-xs text-destructive">{requestError}</p> : null}
              </div>
            </SignedIn>
          ) : null}

          {isPending ? <Badge>Request pending</Badge> : null}

          <SignedOut>
            <p className="text-xs text-muted-foreground">Not signed in.</p>
          </SignedOut>
        </CardContent>
      </Card>
    </div>
  );
}
