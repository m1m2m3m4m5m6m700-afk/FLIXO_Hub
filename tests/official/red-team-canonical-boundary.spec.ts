import { expect, test } from "@playwright/test";

const ONE_BY_ONE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("red-team browser gate rejects a non-executable persisted chain before image processing", async ({ page }) => {
  const unexpectedNetworkRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() !== "GET" && !url.startsWith("http://127.0.0.1")) {
      unexpectedNetworkRequests.push(url);
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      "flixo:tool-chain:v1",
      JSON.stringify([{ id: "image-rotate", order: 0 }]),
    );
  });

  await page.goto("/en/image-rotate");
  const panel = page.getByRole("complementary", { name: "Tool chaining workspace" });
  await panel.getByRole("button", { name: "Open" }).click();

  await panel.locator('input[type="file"]').setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(ONE_BY_ONE_PNG, "base64"),
  });
  await panel.getByRole("button", { name: "Run chain locally" }).click();

  await expect(panel.getByRole("alert")).toContainText(/not executable in the canonical registry/i);
  await expect(panel.getByText(/Output ready:/)).toHaveCount(0);
  expect(unexpectedNetworkRequests).toEqual([]);
});
