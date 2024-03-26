import {test, expect} from '@playwright/test';
import {
    MattermostContainer,
    MattermostPlugin,
    login,
    logout,
} from 'mattermost-plugin-e2e-test-utils';

let mattermost: MattermostContainer;
let demoPluginInstance: MattermostPlugin;

test.beforeAll(async () => {
    demoPluginInstance = new MattermostPlugin({
        packageName: 'com.mattermost.demo-plugin',
        clientid: 'client-id',
        clientsecret: 'client-secret',
        connectedusersallowed: 1000,
        encryptionkey: 'eyPBz0mBhwfGGwce9hp4TWaYzgY7MdIB',
        maxSizeForCompleteDownload: 20,
        maxsizeforcompletedownload: 20,
        tenantid: 'tenant-id',
        webhooksecret: 'webhook-secret',
    }).
        withExternalPath('https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.10.0/com.mattermost.demo-plugin-0.10.0.tar.gz');

    mattermost = await new MattermostContainer().
        withPlugin(demoPluginInstance).
        startWithUserSetup();
});

test.afterAll(async () => {
    await mattermost.stop();
});

test.describe('example test', () => {
    test('check if the town square and plublic channel are created', async ({page}) => {
        const url = mattermost.url();
        await login(page, url, 'regularuser', 'regularuser');
        await expect(page.getByLabel('town square public channel')).toBeVisible();
        await logout(page);
    });
});