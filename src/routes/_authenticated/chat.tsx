import { createFileRoute } from "@tanstack/react-router";
import { OSShell } from "@/components/os/OSShell";
import { ComingSoon } from "@/components/os/ComingSoon";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Team Chat — Seven Day Ventures" }] }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <OSShell
      eyebrow="Collaboration"
      title="Team Chat & Feedback"
      description="Conversations connected to the Hermes Gateway. Thread comments on any idea or venture."
    >
      <ComingSoon
        icon={MessageSquare}
        title="Hermes / Telegram / WhatsApp bridge"
        body="Share the Hermes Gateway URL and credentials and this room becomes a live multi-channel chat with threaded feedback per venture."
      />
    </OSShell>
  );
}
