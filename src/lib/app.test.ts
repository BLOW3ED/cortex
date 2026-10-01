import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { APP_ID, APP_NAME, APP_VERSION } from "./app";

describe("identidad de la app", () => {
  it("APP_ID es inmutable: nombra la base local y marca los respaldos", () => {
    expect(APP_ID).toBe("cortex");
  });

  it("APP_VERSION coincide con package.json", () => {
    expect(APP_VERSION).toBe((JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version);
  });

  it("APP_NAME es el nombre visible", () => {
    expect(APP_NAME).toBe("Cortex");
  });
});
