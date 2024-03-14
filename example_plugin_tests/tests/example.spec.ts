import { test, expect } from "@playwright/test";
import {
  MattermostContainer,
  login,
  logout,
  RunContainerWithExternalPlugin,
} from "mattermost-plugin-e2e-test-utils";

let mattermost: MattermostContainer;

test.beforeAll(async () => {
  mattermost = await RunContainerWithExternalPlugin({
    packageName: "com.mattermost.demo-plugin",
    pluginPath: "https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.10.0/com.mattermost.demo-plugin-0.10.0.tar.gz",
    pluginConfig: {
      "clientid":                   "client-id",
  	  "clientsecret":               "client-secret",
      "connectedusersallowed":      1000,
      "encryptionkey":              "eyPBz0mBhwfGGwce9hp4TWaYzgY7MdIB",
      "maxSizeForCompleteDownload": 20,
      "maxsizeforcompletedownload": 20,
      "tenantid":                   "tenant-id",
      "webhooksecret":              "webhook-secret",
    }
  });
});

test.afterAll(async () => {
  await mattermost.stop();
});

test.describe("link slash command", () => {
  test("try to link a channel as regular user", async ({ page }) => {
    const url = mattermost.url();
    await login(page, url, "regularuser", "regularuser");
    await expect(page.getByLabel("town square public channel")).toBeVisible();
    await logout(page);
  });
});