import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDeckAccessRequests,
  useResolveAccessRequest,
} from "@/features/access-requests/api/useAccessRequestsApi";

type ShareDeckAccessRequestsPanelProps = {
  deckId: string;
};

export function ShareDeckAccessRequestsPanel({
  deckId,
}: ShareDeckAccessRequestsPanelProps) {
  const accessRequests = useDeckAccessRequests(deckId);
  const resolveAccessRequest = useResolveAccessRequest();

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-sm font-semibold">Access Requests</p>
      {!accessRequests?.length && (
        <p className="text-xs text-muted-foreground">No pending or historical requests.</p>
      )}
      {accessRequests?.map((request) => (
        <div
          key={request._id}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-2"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{request.requesterEmail}</p>
            <p className="truncate text-[11px] text-muted-foreground">{request.message ?? "No message"}</p>
            <Badge variant="outline" className="mt-1">
              {request.status}
            </Badge>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={request.status === "approved"}
              onClick={async () => {
                await resolveAccessRequest({
                  requestId: request._id,
                  decision: "approved",
                });
                toast.success("Request approved");
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={request.status === "rejected"}
              onClick={async () => {
                await resolveAccessRequest({
                  requestId: request._id,
                  decision: "rejected",
                });
                toast.success("Request rejected");
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
