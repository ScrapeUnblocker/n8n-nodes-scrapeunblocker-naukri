import { NaukriJobsScraper } from './nodes/NaukriJobsScraper/NaukriJobsScraper.node';
import { ApifyApi } from './credentials/ApifyApi.credentials';

export const nodeTypes = [NaukriJobsScraper];

export const credentialTypes = [ApifyApi];
