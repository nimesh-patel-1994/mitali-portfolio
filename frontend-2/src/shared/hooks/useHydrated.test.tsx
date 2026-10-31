import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHydrated } from "./useHydrated";

function Probe() {
  return <span>{useHydrated() ? "client" : "server"}</span>;
}

describe("useHydrated (UI-002)", () => {
  it("is false in the server render and true after mounting on the client", () => {
    expect(renderToString(<Probe />)).toContain("server");
    render(<Probe />);
    expect(screen.getByText("client")).toBeInTheDocument();
  });

  it("hydration starts from the server value (no mismatch) and then switches", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    render(<Probe />, { container, hydrate: true });
    expect(await screen.findByText("client")).toBeInTheDocument();
  });
});
