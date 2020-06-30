/*
 * Copyright © 2020 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    Configuration,
    configurationValue,
    HttpClientOptions,
    HttpMethod,
    logger,
} from "@atomist/automation-client";
import { toArray } from "@atomist/sdm-core/lib/util/misc/array";
import * as crypto from "crypto";
import * as _ from "lodash";
import {Validator} from "../eventRelay";

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

export function validateHmacSignature(key: string, signature: string, payload: string, algorithm: string = "sha1"): boolean {
    const hmac = crypto.createHmac(algorithm, key);
    const digest = Buffer.from(`${algorithm}=` + hmac.update(payload).digest("hex"), "utf8");
    const checksum = Buffer.from(signature, "utf8");
    return !(checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum));
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

/**
 * This utility function can be used to recursively "redact" a string property on the event object.
 * Substituted property values will have a value of "Redacted" unless optional new value is supplied.
 *
 * @param {Object} o
 * @param {string} property
 * @param {string} newValue Optional value to replace the object property value with.
 */
export function redactObjectProperty(o: any, property: string, newValue: string = "Redacted"): any {
    for (const v of Object.keys(o)) {
        if (o[v] && typeof o[v] === "object") {
            redactObjectProperty(o[v], property, newValue);
        } else if (o[v] && v.toLowerCase() === property.toLowerCase() && typeof o[v] === "string") {
            o[v] = newValue;
        } else if ((o[v] === null || o[v] === undefined) && v.toLowerCase() === property.toLowerCase()) {
            o[v] = newValue;
        }
    }
    return o;
}

/**
 * Default validator, uses API key for authorization.  Must send API key as a authorization bearer token header.
 */
export const apiKeyValidator: Validator = {
    name: "apiKeyValidator",
    handler: async (h, q, p, config) => {
        if (h.authorization) {
            if (typeof h.authorization === "string" && h.authorization.split(" ")[1] === config.apiKey) {
                return {success: true};
            } else {
                return {success: false, message: "Must supply valid API key"};
            }
        } else {
            return {
                success: false,
                message: "Unauthorized.  Must supply token",
            };
        }
    },
};

/**
 * This validator disables all validation
 */
export const nullValidator: Validator = {
    name: "nullValidator",
    handler: async () => {
        return {success: true};
    },
};

/**
 * This function creates a validator that allows you to validate incoming messages via URL query string
 */
export function createQueryStringValidator(name: string, validations: Array<{param: string, value: string}>): Validator {
  return {
    name,
    handler: async (h, q) => {
      let response: {success: boolean, message?: string};
      validations.forEach(v => {
        if (_.get(q, v.param) !== v.value) {
          response = {success: false, message: "Could not validate message!"};
          logger.debug(`${name} vaildator: failed to validate query param [${v.param}] for incoming message`);
        } else {
          response = {success: true};
        }
      });
      return response;
    },
  };
}

/**
 * This validator is used to verify digest message contents sent via Github webhooks.
 */
export const githubHmacValidator: Validator = {
    name: "githubHmacValidator",
    handler: async (h, q, p, config) => {
        const body = JSON.stringify(p);
        const key = _.get(config, "sdm.eventRelay.secret");
        if (!key) {
            logger.error("Missing secret!  You must supply this in your configuration at sdm.eventRelay.secret!");
            return {success: false, message: "Cannot process message."};
        }
        const signature = h["x-hub-signature"] as string;
        if (!signature) {
            logger.error(`Error processing message, invalid.  Expecting a signature header!`);
            logger.debug(`Message missing signature header: ${body}`);
            return {success: false, message: "Cannot process message."};
        }
        if (validateHmacSignature(key, signature, body)) {
            return {success: true};
        }
        return {success: false, message: "Could not validate message!"};
    },
};
