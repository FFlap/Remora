import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  return <Navigate to="/app/decks" />;
}
