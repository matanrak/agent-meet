"use client";

import type { Agent } from "@/lib/types";

interface AgentSidebarProps {
  agents: Agent[];
}

function statusDotColor(status: Agent["status"]): string {
  switch (status) {
    case "active":
      return "bg-green-500";
    case "left":
      return "bg-gray-500";
    case "kicked":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

function statusLabel(status: Agent["status"]): string | null {
  switch (status) {
    case "left":
      return "(left)";
    case "kicked":
      return "(kicked)";
    default:
      return null;
  }
}

export function AgentSidebar({ agents }: AgentSidebarProps) {
  const visibleAgents = agents.filter(
    (a) => a.status === "active" || a.status === "left" || a.status === "kicked"
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Agents ({visibleAgents.length})
      </h3>
      {visibleAgents.length === 0 ? (
        <p className="text-text-secondary text-xs">No agents yet</p>
      ) : (
        <ul className="space-y-2">
          {visibleAgents.map((agent) => (
            <li
              key={agent.agent_id}
              className="flex items-center gap-2"
              data-agent-id={agent.agent_id}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotColor(agent.status)}`}
              />
              <span className="text-sm text-text-primary truncate">
                {agent.agent_name}
              </span>
              {statusLabel(agent.status) && (
                <span className="text-text-secondary text-xs">
                  {statusLabel(agent.status)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
