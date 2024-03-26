import fs from 'fs';

type Config = {
    packageName: string
    path: string
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

    constructor(config: Config) {
        this.config = config;
    }

    getFilenamePath = () => {
        let filename = '';
        const files = fs.readdirSync(this.config.path);
        for (const file of files) {
            if (file.endsWith('.tar.gz')) {
                filename = this.config.path + file;
                break;
            }
        }
        if (filename === '') {
            throw Error('No tar.gz file found in dist folder');
        }

        return filename;
    };
}