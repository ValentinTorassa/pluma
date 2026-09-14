import { describe, expect, it } from "vitest";
import { isValidParent } from "@/lib/comment-parent";

describe("isValidParent", () => {
  it("acepta un comentario aprobado del mismo artículo", () => {
    expect(isValidParent({ articleId: "a1", status: "approved" }, "a1")).toBe(true);
  });

  it("rechaza padre inexistente, no aprobado o de otro artículo", () => {
    expect(isValidParent(undefined, "a1")).toBe(false);
    expect(isValidParent({ articleId: "a1", status: "pending" }, "a1")).toBe(false);
    expect(isValidParent({ articleId: "a1", status: "rejected" }, "a1")).toBe(false);
    expect(isValidParent({ articleId: "a2", status: "approved" }, "a1")).toBe(false);
  });
});
