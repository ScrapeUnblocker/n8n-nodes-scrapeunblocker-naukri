import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import type { OptionField } from './GenericFunctions';
import { applyOptions, requireString, runActorAndGetItems } from './GenericFunctions';

// ScrapeUnblocker's public "Naukri Jobs Scraper" Actor: https://apify.com/scrapeunblocker/naukri-scraper
const ACTOR_ID = 'AvEnjWh7y9FTI9PP9';
const INTEGRATION_APP_ID = 'scrapeunblocker-naukri-scraper';

// Node option name -> Actor input key.
const OPTION_FIELDS: Record<string, OptionField> = {
	location: {
		key: 'location',
	},
	sort: {
		key: 'sort',
	},
	experience: {
		key: 'experience',
	},
	days: {
		key: 'days',
	},
	remote: {
		key: 'remote',
	},
	proxyCountry: {
		key: 'proxy_country',
		kind: 'upper',
	},
};

function buildActorInput(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	options: IDataObject,
	itemIndex: number,
): IDataObject {
	const input: IDataObject = {};

	switch (`${resource}:${operation}`) {
		case 'job:search': {
			input.keyword = requireString.call(this, 'keyword', 'Keyword', itemIndex);
			input.max_results = this.getNodeParameter('maxResults', itemIndex);
			break;
		}
		default:
			throw new NodeOperationError(
				this.getNode(),
				`The operation "${operation}" is not supported for resource "${resource}"`,
				{ itemIndex },
			);
	}

	applyOptions(input, options, OPTION_FIELDS);
	return input;
}

export class NaukriJobsScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Naukri Jobs Scraper',
		name: 'naukriJobsScraper',
		icon: {
			light: 'file:naukriJobsScraper.png',
			dark: 'file:naukriJobsScraper.dark.png',
		},
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Search Naukri.com job listings in India by keyword and city with the ScrapeUnblocker Actor on Apify',
		defaults: {
			name: 'Naukri Jobs Scraper',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'apifyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Job',
						value: 'job',
					},
				],
				default: 'job',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['job'],
					},
				},
				options: [
					{
						name: 'Search',
						value: 'search',
						description: 'Search Naukri jobs by keyword',
						action: 'Search jobs',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Keyword',
				name: 'keyword',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'python developer',
				description: "What to search for, e.g. 'python developer' or 'data analyst'",
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Max Results',
				name: 'maxResults',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 1000,
				},
				default: 40,
				description: 'How many jobs to collect across pages (1-1000, about 20 per page)',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Experience (Years)',
						name: 'experience',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 30,
						},
						default: 0,
						description:
							'Candidate experience in years (0-30). Only jobs open to this much experience are returned.',
					},
					{
						displayName: 'Location',
						name: 'location',
						type: 'string',
						default: '',
						placeholder: 'Bangalore',
						description:
							"City to search in, e.g. 'Bangalore' or 'Mumbai'. Leave blank for all of India.",
					},
					{
						displayName: 'Posted Within',
						name: 'days',
						type: 'options',
						options: [
							{
								name: 'Any Time',
								value: '',
							},
							{
								name: 'Last 1 Day',
								value: '1',
							},
							{
								name: 'Last 15 Days',
								value: '15',
							},
							{
								name: 'Last 3 Days',
								value: '3',
							},
							{
								name: 'Last 30 Days',
								value: '30',
							},
							{
								name: 'Last 7 Days',
								value: '7',
							},
						],
						default: '',
						description: 'Only jobs posted within this time window',
					},
					{
						displayName: 'Proxy Country',
						name: 'proxyCountry',
						type: 'string',
						default: '',
						placeholder: 'IN',
						description: 'Exit-IP country (ISO-2, e.g. IN). Leave blank to pick one automatically.',
					},
					{
						displayName: 'Remote Only',
						name: 'remote',
						type: 'boolean',
						default: false,
						description: 'Whether to return only work-from-home / remote jobs',
					},
					{
						displayName: 'Sort By',
						name: 'sort',
						type: 'options',
						options: [
							{
								name: 'Date (Newest First)',
								value: 'date',
							},
							{
								name: 'Relevance',
								value: 'relevance',
							},
						],
						default: 'relevance',
						description: 'Order the results by relevance or by date',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
						description:
							'Maximum run time of the Apify Actor run. 0 keeps the Actor default. A run that times out fails the node.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const { timeout, ...actorOptions } = options;

				const input = buildActorInput.call(this, resource, operation, actorOptions, i);
				const { items: results } = await runActorAndGetItems.call(this, {
					actorId: ACTOR_ID,
					integrationAppId: INTEGRATION_APP_ID,
					input,
					itemIndex: i,
					timeoutSecs: (timeout as number) || undefined,
				});

				for (const result of results) {
					returnData.push({ json: result, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors return an error of their own class unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
