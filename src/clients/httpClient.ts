import nodeFetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import Logger from '../other/logger';

export type FetchHandlerVars = {
    url: string,
    method: 'GET' | 'POST',
    data?: any,
    headers?: any,
    proxy?: string,
    logger: Logger,
    moduleString?: string
}
export const fetchHandler = async (params: FetchHandlerVars): Promise<any> => {
    let agent: HttpsProxyAgent<any> | undefined;
    if (params.proxy) {
        // @ts-ignore
        agent = new HttpsProxyAgent(params.proxy);
    }

    const response: Response = await fetchWithTimeout(params.url, {
        method: params.method,
        headers: params.headers,
        body: params.data,
        // @ts-ignore
        agent: agent
    }, 3000);

    if (response.status !== 200) {

        if (response.status === 429) {
            throw Error(`[fetchHandler]${params.moduleString} - Rate limit | ${params.url} | ${params.proxy} | ${response.status}`);
        }
        if (response.status!==520 && response.status !== 524) {
            await params?.logger?.info({
                message: `[fetchHandler]${params.moduleString} - Status code ${response.status}`,
            });
            throw Error(`[fetchHandler]${params.moduleString} - Status code ${response.status}`);
        }
        throw Error(`[fetchHandler]${params.moduleString} - Status code ${response.status}`);
    } else {
        return response;
    }
};

async function fetchWithTimeout ( url: string, options: RequestInit = {}, timeout = 3000): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {

        const timer = setTimeout(() => {
            reject(new Error('Request timed out, probably API dead'));
        }, timeout);

        // @ts-ignore
        nodeFetch(url, options)
            .then(response => {
                clearTimeout(timer);
                // @ts-ignore
                resolve(response);
            })
            .catch(reject);
    });
}