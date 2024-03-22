import fs from 'fs';

import {test, expect} from '@playwright/test';

import MattermostContainer from './mmcontainer';

type PluginConfig = {
    clientid: string
    clientsecret: string
    connectedusersallowed: number
    encryptionkey: string
    maxSizeForCompleteDownload: number
    maxsizeforcompletedownload: number
    tenantid: string
    webhooksecret: string
}

type RunContainerWithExternalPluginParams = {
    packageName: string
    pluginPath: string
    pluginConfig: PluginConfig
}

type RunContainerParams = {
    packageName: string
    distPath: string
    pluginConfig: PluginConfig
}

type RunContainerConfig = {
    packageName: string
    filename: string
    pluginConfig: PluginConfig
}

export const RunContainerWithExternalPlugin = async ({packageName, pluginPath, pluginConfig}: RunContainerWithExternalPluginParams): Promise<MattermostContainer> => {
    return RunContainerInternal({packageName, filename: pluginPath, pluginConfig});
};

export const RunContainer = async ({packageName, distPath, pluginConfig}: RunContainerParams): Promise<MattermostContainer> => {
    let filename = '';
    const files = fs.readdirSync(distPath);
    for (const file of files) {
        if (file.endsWith('.tar.gz')) {
            filename = distPath + file;
            break;
        }
    }
    if (filename === '') {
        throw ('No tar.gz file found in dist folder');
    }

    return RunContainerInternal({packageName, filename, pluginConfig});
};

const RunContainerInternal = async ({packageName, filename, pluginConfig}: RunContainerConfig): Promise<MattermostContainer> => {
    const mattermost = await new MattermostContainer().
        withPlugin(filename, packageName, pluginConfig).
        withEnv('MM_MSTEAMSSYNC_MOCK_CLIENT', 'true').
        start();
    await mattermost.createUser('regularuser@sample.com', 'regularuser', 'regularuser');
    await mattermost.addUserToTeam('regularuser', 'test');
    const userClient = await mattermost.getClient('regularuser', 'regularuser');
    const user = await userClient.getMe();
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
        {
            user_id: user.id,
            category: 'drafts',
            name: 'drafts_tour_tip_showed',
            value: JSON.stringify({drafts_tour_tip_showed: true}),
        },
        {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
    ]);

    const adminClient = await mattermost.getAdminClient();
    const admin = await adminClient.getMe();
    await adminClient.savePreferences(admin.id, [
        {user_id: admin.id, category: 'tutorial_step', name: admin.id, value: '999'},
        {user_id: admin.id, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: admin.id, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
        {
            user_id: admin.id,
            category: 'drafts',
            name: 'drafts_tour_tip_showed',
            value: JSON.stringify({drafts_tour_tip_showed: true}),
        },
        {user_id: admin.id, category: 'crt_thread_pane_step', name: admin.id, value: '999'},
    ]);
    await adminClient.completeSetup({
        organization: 'test',
        install_plugins: [],
    });

    return mattermost;
};