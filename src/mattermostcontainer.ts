import {StartedTestContainer, GenericContainer, StartedNetwork, Network, Wait} from 'testcontainers';
import {StartedPostgreSqlContainer, PostgreSqlContainer} from '@testcontainers/postgresql';
import {Client4} from '@mattermost/client';
import {Client} from 'pg';

import {MattermostPlugin} from './plugin';

const defaultEmail = 'admin@example.com';
const defaultUsername = 'admin';
const defaultPassword = 'admin';
const defaultTeamName = 'test';
const defaultTeamDisplayName = 'Test';
const defaultMattermostImage = 'mattermost/mattermost-enterprise-edition';

// MattermostContainer represents the mattermost container type used in the module
export default class MattermostContainer {
    container: StartedTestContainer;
    pgContainer: StartedPostgreSqlContainer;
    network: StartedNetwork;
    email: string;
    username: string;
    password: string;
    teamName: string;
    teamDisplayName: string;
    envs: {[key: string]: string};
    command: string[];
    configFile: any[];
    plugins: MattermostPlugin[];

    constructor() {
        this.command = ['mattermost', 'server'];
        const dbconn = 'postgres://user:pass@db:5432/mattermost_test?sslmode=disable';
        this.envs = {
            MM_SQLSETTINGS_DATASOURCE: dbconn,
            MM_SQLSETTINGS_DRIVERNAME: 'postgres',
            MM_SERVICESETTINGS_ENABLELOCALMODE: 'true',
            MM_PASSWORDSETTINGS_MINIMUMLENGTH: '5',
            MM_PLUGINSETTINGS_ENABLEUPLOADS: 'true',
            MM_FILESETTINGS_MAXFILESIZE: '256000000',
            MM_LOGSETTINGS_CONSOLELEVEL: 'DEBUG',
            MM_LOGSETTINGS_FILELEVEL: 'DEBUG',
        };
        this.email = defaultEmail;
        this.username = defaultUsername;
        this.password = defaultPassword;
        this.teamName = defaultTeamName;
        this.teamDisplayName = defaultTeamDisplayName;
        this.plugins = [];
        this.configFile = [];
    }

    url(): string {
        const containerPort = this.container.getMappedPort(8065);
        const host = this.container.getHost();
        return `http://${host}:${containerPort}`;
    }

    db = async (): Client => {
        const port = this.pgContainer.getMappedPort(5432);
        const host = this.pgContainer.getHost();
        const database = 'mattermost_test';
        const client = new Client({user: 'user', password: 'pass', host, port, database});
        await client.connect();
        return client;
    };

    getAdminClient = async (): Promise<Client4> => {
        return this.getClient(this.username, this.password);
    };

    getClient = async (username: string, password: string): Promise<Client4> => {
        const url = this.url();
        const client = new Client4();
        client.setUrl(url);
        await client.login(username, password);
        return client;
    };

    stop = async () => {
        await this.pgContainer.stop();
        await this.container.stop();
        await this.network.stop();
    };

    createAdmin = async (email: string, username: string, password: string) => {
        await this.container.exec(['mmctl', '--local', 'user', 'create', '--email', email, '--username', username, '--password', password, '--system-admin', '--email-verified']);
    };

    createUser = async (email: string, username: string, password: string) => {
        await this.container.exec(['mmctl', '--local', 'user', 'create', '--email', email, '--username', username, '--password', password, '--email-verified']);
    };

    createTeam = async (name: string, displayName: string) => {
        await this.container.exec(['mmctl', '--local', 'team', 'create', '--name', name, '--display-name', displayName]);
    };

    addUserToTeam = async (username: string, teamname: string) => {
        await this.container.exec(['mmctl', '--local', 'team', 'users', 'add', teamname, username]);
    };

    getLogs = async (lines: number): Promise<string> => {
        const {output} = await this.container.exec(['mmctl', '--local', 'logs', '--number', lines.toString()]);
        return output;
    };

    setSiteURL = async () => {
        const url = this.url();
        await this.container.exec(['mmctl', '--local', 'config', 'set', 'ServiceSettings.SiteURL', url]);
        const containerPort = this.container.getMappedPort(8065);
        await this.container.exec(['mmctl', '--local', 'config', 'set', 'ServiceSettings.ListenAddress', `${containerPort}`]);
    };

    installPluginFromLocalBinary = async (plugin: MattermostPlugin) => {
        const {packageName} = plugin.config;

        const patch = JSON.stringify({PluginSettings: {Plugins: {[packageName]: plugin.config}}});

        await this.container.copyFilesToContainer([{source: plugin.path, target: '/tmp/plugin.tar.gz'}]);
        await this.container.copyContentToContainer([{content: patch, target: '/tmp/plugin.config.json'}]);

        await this.container.exec(['mmctl', '--local', 'plugin', 'add', '/tmp/plugin.tar.gz']);
        await this.container.exec(['mmctl', '--local', 'config', 'patch', '/tmp/plugin.config.json']);
        await this.container.exec(['mmctl', '--local', 'plugin', 'enable', packageName]);
    };

    installPluginFromUrl = async (plugin: MattermostPlugin) => {
        const client = await this.getAdminClient();
        const manifest = await client.installPluginFromUrl(plugin.path);
        await this.container.exec(['mmctl', '--local', 'plugin', 'enable', manifest.id]);
    };

    withEnv = (env: string, value: string): MattermostContainer => {
        this.envs[env] = value;
        return this;
    };

    withAdmin = (email: string, username: string, password: string): MattermostContainer => {
        this.email = email;
        this.username = username;
        this.password = password;
        return this;
    };

    withTeam = (teamName: string, teamDisplayName: string): MattermostContainer => {
        this.teamName = teamName;
        this.teamDisplayName = teamDisplayName;
        return this;
    };

    withConfigFile = (cfg: string): MattermostContainer => {
        const cfgFile = {
            source: cfg,
            target: '/etc/mattermost.json',
        };
        this.configFile.push(cfgFile);
        this.command.push('-c', '/etc/mattermost.json');
        return this;
    };

    withPlugin = (plugin: MattermostPlugin): MattermostContainer => {
        this.plugins.push(plugin);
        return this;
    };

    start = async (): Promise<MattermostContainer> => {
        this.network = await new Network().start();
        this.pgContainer = await new PostgreSqlContainer('docker.io/postgres:15.2-alpine').
            withExposedPorts(5432).
            withDatabase('mattermost_test').
            withUsername('user').
            withPassword('pass').
            withNetworkMode(this.network.getName()).
            withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections')).
            withNetworkAliases('db').
            start();

        this.container = await new GenericContainer(defaultMattermostImage).
            withEnvironment(this.envs).
            withExposedPorts(8065).
            withNetwork(this.network).
            withNetworkAliases('mattermost').
            withCommand(this.command).
            withWaitStrategy(Wait.forLogMessage('Server is listening on')).
            withCopyFilesToContainer(this.configFile).
            start();

        await this.setSiteURL();
        await this.createAdmin(this.email, this.username, this.password);
        await this.createTeam(this.teamName, this.teamDisplayName);
        await this.addUserToTeam(this.username, this.teamName);

        const pluginsToInstall: Promise<void>[] = [];
        for (const plugin of this.plugins) {
            if (plugin.isExternal) {
                pluginsToInstall.push(this.installPluginFromUrl(plugin));
            } else {
                pluginsToInstall.push(this.installPluginFromLocalBinary(plugin));
            }
        }
        await Promise.all(pluginsToInstall);

        return this;
    };

    startWithUserSetup = async (): Promise<MattermostContainer> => {
        await this.start();

        await this.createUser('regularuser@sample.com', 'regularuser', 'regularuser');
        await this.addUserToTeam('regularuser', 'test');
        const userClient = await this.getClient('regularuser', 'regularuser');
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

        const adminClient = await this.getAdminClient();
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

        return this;
    };
}