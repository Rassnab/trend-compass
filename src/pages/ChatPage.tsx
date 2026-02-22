import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions about the report corpus — grounded answers with citations
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Chat will be available once reports have been ingested and indexed.
        </p>
      </div>
    </div>
  );
}
