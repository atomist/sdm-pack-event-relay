import {Configuration, configurationValue, HttpClientOptions, HttpMethod, logger} from "@atomist/automation-client";
import {toArray} from "@atomist/sdm-core/lib/util/misc/array";
import * as crypto from "crypto";
import * as _ from "lodash";

export function createHmacSignature(key: string, payload: any, algorithm: string = "sha1"): string {
    const digest = crypto.createHmac(algorithm, key);
    digest.update(JSON.stringify(payload));
    return digest.digest("hex");
}

export function addAtomistSignatureHeader(
    key: string,
    payload: any,
    headers: HttpClientOptions["headers"],
    algorithm: "sha1" | "sha256" = "sha1",
): HttpClientOptions["headers"] {
    headers["x-hub-signature"] = `${algorithm}=${createHmacSignature(key, payload, algorithm)}`;
    return headers;
}

export function purgeCommonHeaders(
    headers: HttpClientOptions["headers"],
): HttpClientOptions["headers"] {
    delete headers.host;
    delete headers.expect;
    delete headers["content-length"];
    delete headers.authorization;
    delete headers["user-agent"];
    delete headers.accept;

    return headers;
}

/**
 * Post data to an ingester webhook using httpClient from the SDM
 * @param {string | string[]} url The url to send data to
 * @param {any} payload Payload of data to send to the endpoint (object form; gets converted to JSON)
 * @param {HttpClientOptions["headers"]} headers
 */
export async function sdmPostWebhook(
    url: string[] | string,
    headers: HttpClientOptions["headers"] = {},
    payload: any,
    ): Promise<void> {
    const config = configurationValue<Configuration>();
    logger.debug(`sdmPostWebHook: Headers => ${JSON.stringify(headers)}`);
    try {
        for (const dest of toArray(url)) {
            const httpClient = config.http.client.factory.create(dest);

            const result = await httpClient.exchange(
                dest,
                {
                    method: HttpMethod.Post,
                    body: JSON.stringify(payload),
                    headers: _.merge({
                        ["Content-Type"]: "application/json",
                    }, headers),
                });
            logger.debug(`sdmPostWebhook Result: ${JSON.stringify(result.body)}`);
        }
    } catch (e) {
        const correlationId = _.get(e, "response.headers.x-atomist-correlation-id", "Not Defined");
        logger.error(`sdmPostWebhook:  Error! Failed to send webhook (correlation-id: ${correlationId}).  Failure => ${e.message}`);
        throw new Error(e);
    }
}
