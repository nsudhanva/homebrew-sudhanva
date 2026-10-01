// Type definitions for the sudhanva package, the client for the public sudhanva.me API.

/** The version of this package. */
export declare const VERSION: string;
/** The production API base URL, `https://sudhanva.me/api/v1`. */
export declare const DEFAULT_BASE_URL: string;
/** The User-Agent product token sent with every request outside browsers, such as `sudhanva-js/0.2.0`. */
export declare const USER_AGENT: string;

/** A `fetch`-compatible function. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ClientOptions {
	/** API base URL. Defaults to `https://sudhanva.me/api/v1`. */
	baseUrl?: string | URL;
	/** A `fetch` implementation. Defaults to the global `fetch`. */
	fetch?: FetchLike;
	/** Per-request timeout in milliseconds. Defaults to 10000. Pass `Infinity` to disable. */
	timeout?: number;
	/** Text appended to the `User-Agent` header, such as `my-app/1.0`. Ignored in browsers. */
	userAgent?: string;
}

export interface RequestOptions {
	/** Cancels the request. Combined with the client timeout. */
	signal?: AbortSignal;
}

export type Locale = 'en';

export interface LocaleOptions extends RequestOptions {
	/** Content locale. `en` is the only published locale. */
	locale?: Locale;
}

export interface PostsOptions extends LocaleOptions {
	/** Page size from 1 to 100. The API default is 20. */
	limit?: number;
	/** Exact lowercase tag, such as `kubernetes`. */
	tag?: string;
	/** A previous page's `next_cursor`. */
	cursor?: string;
}

export type AllPostsOptions = Omit<PostsOptions, 'cursor'>;

export type AskMode = 'list' | 'summarize' | 'list, summarize';

export interface AskOptions extends RequestOptions {
	/** Maximum number of results from 1 to 20. Defaults to 10. POST only. */
	limit?: number;
	/** NLWeb mode. Defaults to `list`. POST only. */
	mode?: AskMode;
	/** `POST` (default) sends the full NLWeb request; `GET` sends only the query text. */
	method?: 'GET' | 'POST';
}

export interface WaitOptions extends RequestOptions {
	/** Delay between polls in milliseconds. Defaults to 1000. Zero polls again immediately. */
	pollInterval?: number;
	/** Total time to wait in milliseconds before throwing. Defaults to 30000. */
	timeout?: number;
}

export interface ApiIndex {
	name: string;
	version: string;
	status: 'stable';
	description: string;
	documentation_url: string;
	openapi_url: string;
	versioning_policy_url: string;
	mcp_url: string;
	cli_url: string;
	sdks_url: string;
	sdk_catalog_url: string;
	endpoints: { profile: string; posts: string; profile_insights: string; batch: string };
	[key: string]: unknown;
}

export interface Organization {
	name: string;
	url: string;
}

export interface Profile {
	name: string;
	jobTitle: string;
	specialization: string;
	location: string;
	url: string;
	email: string;
	worksFor: Organization;
	knowsAbout: string[];
	sameAs: string[];
}

export interface ProfileResponse {
	profile: Profile;
}

export interface Post {
	slug: string;
	title: string;
	description: string;
	/** RFC 3339 timestamp. */
	publishedAt: string;
	/** RFC 3339 timestamp. */
	updatedAt: string;
	tags: string[];
	category: string | null;
	url: string;
}

export interface PostList {
	count: number;
	total: number;
	/** Cursor for the next page, or `null` on the last page. */
	next_cursor: string | null;
	posts: Post[];
}

export interface PostResponse {
	post: Post;
}

/** An error object inside a batch result or a failed job. */
export interface ErrorDetail {
	code: string;
	message: string;
	hint?: string;
	docs_url?: string;
}

export interface BatchOperation {
	/** Caller-chosen identifier, 1 to 64 characters, echoed in the result. */
	id: string;
	/** The API accepts only `GET`. Defaults to `GET`. */
	method?: 'GET';
	/** Relative API path: `/profile`, `/posts` with an optional query, or `/posts/{slug}`. */
	path: string;
}

export interface BatchResult {
	id: string;
	/** The HTTP status the operation would have returned on its own. */
	status: number;
	body?: Record<string, unknown>;
	error?: ErrorDetail;
}

export interface BatchResponse {
	count: number;
	results: BatchResult[];
}

export type Audience = 'recruiter' | 'hiring-manager' | 'collaborator' | 'researcher' | 'agent';

export type FocusArea =
	| 'production-ml'
	| 'ml-infrastructure'
	| 'inference'
	| 'kubernetes'
	| 'distributed-systems'
	| 'technical-writing'
	| 'career';

export interface ProfileInsightRequest {
	audience: Audience;
	/** Up to five unique areas. The API defaults to `["production-ml"]`. */
	focus?: readonly FocusArea[];
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface CaseStudy {
	title: string;
	summary: string;
	proof_points: string[];
	url: string;
}

export interface SuggestedPage {
	title: string;
	url: string;
}

export interface ProfileInsightResult {
	title: string;
	audience: string;
	focus: string[];
	summary: string;
	highlights: string[];
	case_studies: CaseStudy[];
	suggested_pages: SuggestedPage[];
}

export interface ProfileInsightJob {
	/** Such as `pi_0123456789abcdef0123456789abcdef`. */
	job_id: string;
	status: JobStatus;
	/** Absolute URL for polling the job. */
	status_url: string;
	created_at: string;
	updated_at: string;
	/** 24 hours after creation. */
	expires_at: string;
	result?: ProfileInsightResult;
	error?: ErrorDetail;
}

export interface AskMeta {
	response_type: 'answer' | 'failure';
	response_format?: 'conversational_search';
	version: string;
	request_id?: string;
	[key: string]: unknown;
}

export interface AskResult {
	/** The schema.org type, such as `Person` or `CreativeWork`. */
	'@type': string;
	name?: string;
	description?: string;
	url?: string;
	grounding?: { url?: string; [key: string]: unknown };
	[key: string]: unknown;
}

export interface AskResponse {
	_meta: AskMeta;
	results: AskResult[];
}

export interface ApiErrorInit {
	status: number;
	code: string;
	message: string;
	hint?: string;
	docsUrl?: string;
	type?: string;
	title?: string;
	detail?: string;
	instance?: string;
	contentType?: string;
	headers?: Headers;
	body?: unknown;
}

/**
 * A non-success response from the API. Both the JSON error envelope and RFC 9457
 * `application/problem+json` documents are decoded into the same fields.
 */
export declare class ApiError extends Error {
	constructor(init: ApiErrorInit);
	/** Builds an error from a response. Never throws, whatever the body contains. */
	static fromResponse(
		status: number,
		contentType: string | undefined,
		bodyText: string,
		headers?: Headers,
	): ApiError;
	readonly name: 'ApiError';
	/** HTTP status code. */
	status: number;
	/** Machine-readable code, such as `POST_NOT_FOUND`. `api_error` when the body has none. */
	code: string;
	/** Human-readable explanation. */
	message: string;
	/** Suggested fix, from the JSON envelope. */
	hint?: string;
	/** Documentation link: the envelope's `docs_url` or the problem `type` URL. */
	docsUrl?: string;
	/** Problem `type` URI. */
	type?: string;
	/** Problem `title`. */
	title?: string;
	/** Problem `detail`. */
	detail?: string;
	/** Problem `instance`. */
	instance?: string;
	/** Response `Content-Type`. */
	contentType?: string;
	/** Response headers, such as `Retry-After`. */
	headers?: Headers;
	/** Decoded JSON body, the raw text when it is not JSON, or `null` when empty. */
	body: unknown;
}

/** Thrown by `waitForProfileInsight` when a job is still pending after the timeout. */
export declare class ProfileInsightTimeoutError extends Error {
	constructor(jobId: string, timeout: number, job: ProfileInsightJob);
	readonly name: 'ProfileInsightTimeoutError';
	jobId: string;
	/** The configured timeout in milliseconds. */
	timeout: number;
	/** The last job state that was read. */
	job: ProfileInsightJob;
}

/** A client for every stable public API operation. */
export declare class Client {
	constructor(options?: ClientOptions);
	/** The API base URL without a trailing slash. */
	readonly baseUrl: string;
	/** The site origin, where NLWeb `/ask` lives. */
	readonly siteUrl: string;

	/** `GET /`, the API index. */
	apiIndex(options?: LocaleOptions): Promise<ApiIndex>;
	/** `GET /profile` */
	profile(options?: LocaleOptions): Promise<ProfileResponse>;
	/** `GET /posts`, one page, newest first. */
	posts(options?: PostsOptions): Promise<PostList>;
	/** Every post, following `next_cursor` across pages. */
	allPosts(options?: AllPostsOptions): AsyncGenerator<Post, void, undefined>;
	/** `GET /posts/{slug}` */
	post(slug: string, options?: LocaleOptions): Promise<PostResponse>;
	/** `POST /batch` with 1 to 20 operations. */
	batch(operations: readonly BatchOperation[], options?: RequestOptions): Promise<BatchResponse>;
	/** `POST /ask` (or `GET /ask`) on the site origin: NLWeb 0.55 conversational search. */
	ask(text: string, options?: AskOptions): Promise<AskResponse>;
	/** `POST /profile-insights` with an `Idempotency-Key` header. */
	createProfileInsight(
		request: ProfileInsightRequest,
		idempotencyKey: string,
		options?: RequestOptions,
	): Promise<ProfileInsightJob>;
	/** `GET /profile-insights/{job_id}` */
	profileInsight(jobId: string, options?: RequestOptions): Promise<ProfileInsightJob>;
	/** Polls until the job is `succeeded` or `failed` and returns it. */
	waitForProfileInsight(jobId: string, options?: WaitOptions): Promise<ProfileInsightJob>;
}
