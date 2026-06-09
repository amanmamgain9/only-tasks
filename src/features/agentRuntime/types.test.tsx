import React from "react";
import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createAgentUiBlockRenderer, type AgentUiBlockRegistry } from "./types";

type TestBlock =
  | { type: "note"; text: string }
  | { type: "counter"; count: number };

describe("agent UI block registry", () => {
  test("renders typed blocks through a trusted registry", () => {
    const registry: AgentUiBlockRegistry<TestBlock> = {
      note: (block) => <p>{block.text}</p>,
      counter: (block) => <strong>{block.count}</strong>,
    };
    const renderBlock = createAgentUiBlockRenderer(registry);

    expect(renderToStaticMarkup(<>{renderBlock({ type: "note", text: "hello" })}</>)).toBe("<p>hello</p>");
    expect(renderToStaticMarkup(<>{renderBlock({ type: "counter", count: 3 })}</>)).toBe("<strong>3</strong>");
  });
});
