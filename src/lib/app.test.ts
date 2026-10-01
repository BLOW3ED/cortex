import { describe, expect, it } from "vitest";
import { APP_ID, APP_NAME } from "./app";

describe("identidad de la app", () => {
  it("APP_ID es inmutable: nombra la base local y marca los respaldos", () => {
    expect(APP_ID).toBe("cortex");
  });

  it("APP_NAME es el nombre visible", () => {
    expect(APP_NAME).toBe("Cortex");
  });
});
