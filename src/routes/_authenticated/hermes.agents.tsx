import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllHermesAgents } from "@/lib/api/hermes.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hermes/agents")({
  component: HermesAgentsPage,
});

function HermesAgentsPage() {
  const fn = useServerFn(listAllHermesAgents);
  const q = useQuery({ queryKey: ["hermesAgentsAll"], queryFn: () => fn() });
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-ember">Hermes</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Agent management</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Every agent spawned across your tasks. Drill into a task to see its live timeline.
      </p>
      {q.isLoading && <Loader2 className="mt-8 h-5 w-5 animate-spin text-muted-foreground" />}
      {q.error && <p className="mt-6 text-destructive">{(q.error as Error).message}</p>}
      {q.data && q.data.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No agents yet.</p>
      )}
      {q.data && q.data.length > 0 && (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Iterations</th>
                <th className="px-4 py-3 text-left">Task</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((a) => (
                <tr key={a.id} className="border-t border-border hover:bg-card/40">
                  <td className="px-4 py-3 uppercase text-xs tracking-wider text-ember">{a.role}</td>
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.model}</td>
                  <td className="px-4 py-3">{a.status}</td>
                  <td className="px-4 py-3">{a.iteration_count}</td>
                  <td className="px-4 py-3 max-w-xs truncate">
                    <Link
                      to="/hermes/$taskId"
                      params={{ taskId: a.task_id }}
                      className="text-ember hover:underline"
                    >
                      {a.hermes_tasks?.goal?.slice(0, 60) ?? a.task_id.slice(0, 8)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
