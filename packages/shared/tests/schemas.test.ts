import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "../src/index.js";

describe("shared Phase 1 schemas", () => {
  it("accepts the API health contract", () => {
    expect(healthResponseSchema.parse({ ok: true, service: "D3 API" })).toEqual({
      ok: true,
      service: "D3 API"
    });
  });

  it("rejects unexpected health payload fields", () => {
    expect(
      healthResponseSchema.safeParse({
        ok: true,
        service: "D3 API",
        featureFlag: "not-yet"
      }).success
    ).toBe(false);
  });
});
