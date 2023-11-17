// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';
import fs from 'node:fs';

import {test} from '@e2e-support/test_fixture';
import {DeepPartial} from '@mattermost/types/utilities';
import {AdminConfig} from '@mattermost/types/config';

import {cleanUpBotDMs} from './utils';
import {clearKVStoreForPlugin} from './kv';
import {preferencesForUser} from './user';

const pluginDistPath = path.join(__dirname, '../../../../dist');

export type InitializeTestsOptions<PluginConfig> = {
    pluginId: string;
    botUsername: string;
    pluginConfig: PluginConfig;
}

export const initialize = async <PluginConfig>({pluginId, botUsername, pluginConfig}: InitializeTestsOptions<PluginConfig>) => {
    test.beforeAll(async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (adminUser === null) {
            throw new Error('can not get adminUser');
        }

        // Clear KV store
        await clearKVStoreForPlugin(pluginId);

        // Upload and enable plugin
        const files = await fs.promises.readdir(pluginDistPath);
        const bundle = files.find((fname) => fname.endsWith('.tar.gz'));
        if (!bundle) {
            throw new Error('Failed to find plugin bundle in dist folder');
        }

        const bundlePath = path.join(pluginDistPath, bundle);
        await adminClient.uploadPluginX(bundlePath, true);
        await adminClient.enablePlugin(pluginId);

        // Configure plugin
        const serverConfig = await adminClient.getConfig();
        const newConfig: DeepPartial<AdminConfig> = {
            ServiceSettings: {
                EnableTutorial: false,
                EnableOnboardingFlow: false,
            },
            PluginSettings: {
                ...serverConfig.PluginSettings,
                Plugins: {
                    ...serverConfig.PluginSettings.Plugins,
                    [pluginId]: pluginConfig,
                },
            },
        };

        await adminClient.patchConfig(newConfig);
        await adminClient.savePreferences(adminUser.id, preferencesForUser(adminUser.id));
    });

    // # Clear bot DM channel
    test.beforeEach(async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (adminUser === null) {
            throw new Error('can not get adminUser');
        }
        await cleanUpBotDMs(adminClient, adminUser.id, botUsername);
    });
};

import {ExpiryAlgorithms, makeOAuthServer} from '../mock_oauth_server/mock_oauth_server';

export const runOAuthServer = async (mockOAuthAccessToken: string) => {
    const defaultAuthorizePrefix = '/login/oauth'; // Used by GitHub
    const authorizeURLPrefix = process.env.OAUTH_AUTHORIZE_URL_PREFIX || defaultAuthorizePrefix;

    const mattermostSiteURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';
    const pluginId = process.env.MM_PLUGIN_ID || 'github';

    const app = makeOAuthServer({
        authorizeURLPrefix,
        mattermostSiteURL,
        mockOAuthAccessToken,
        pluginId,
        expiryAlgorithm: ExpiryAlgorithms.NO_EXPIRY,
    });

    const port = process.env.OAUTH_SERVER_PORT || 8080;
    try {
        app.listen(port, () => {
            console.log(`Mock OAuth server listening on port ${port}`);
        });
    } catch (e) {
        console.error(e);
    }
};
