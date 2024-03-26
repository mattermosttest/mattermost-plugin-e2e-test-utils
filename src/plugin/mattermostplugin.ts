import fs from 'fs';

type Config = {
    packageName: string
    clientid: string
    clientsecret: string
    connectedusersallowed: number
    encryptionkey: string
    maxSizeForCompleteDownload: number
    maxsizeforcompletedownload: number
    tenantid: string
    webhooksecret: string
}

export default class MattermostPlugin {
    config: Config;
    isExternal: boolean = false;
    path: string;

    constructor(config: Config) {
        this.config = config;
    }

    withExternalPath = (externalPath: string): MattermostPlugin => {
        this.isExternal = true;
        this.path = externalPath;

        return this;
    };

    withLocalBinary = (path: string): MattermostPlugin => {
        let filename = '';
        const files = fs.readdirSync(path);
        for (const file of files) {
            if (file.endsWith('.tar.gz')) {
                filename = path + file;
                break;
            }
        }
        if (filename === '') {
            throw Error('No tar.gz file found in dist folder');
        }

        return this;
    };
}