import {
    Configuration,
    configurationValue,
    EventFired,
    HandlerContext,
    HandlerResult,
    HttpClientOptions,
    HttpMethod,
    logger,
    Success,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {toArray} from "@atomist/sdm-core/lib/util/misc/array";
import {IncomingHttpHeaders} from "http";
import _ = require("lodash");
import {EventRelayer} from "../eventRelay";
import {purgeCommonHeaders} from "../support/util";

export interface EventRelayData<DATA = any> {
    body: DATA;
    headers: IncomingHttpHeaders;
}

// TODO: I don't want a graphQL subscription here, but I have to have it or I get errors
@EventHandler("Handle eventRelay events", "subscription Placeholder { HerokuApp { app } }")
export class EventRelayHandler implements HandleEvent<any> {
    public handle(event: EventFired<EventRelayData>, ctx: HandlerContext): Promise<HandlerResult> {
        return new Promise<HandlerResult>(async (resolve, reject) => {
            /**
             * Load Event Relayers
             */
            const relayers = configurationValue<EventRelayer[]>("sdm.eventRelayers");

            /**
             * For each relayer, run provided test to see if it's a match; store the ones that are
             */
            const relayersForThisEvent: EventRelayer[] = [];
            for (const r of relayers) {
                if (r.test(event.data)) {
                    relayersForThisEvent.push(r);
                }
            }

            if (relayersForThisEvent.length === 0) {
                logger.debug(`No EventRelayers found for this event`);
                resolve({code: 0});
            }

            /**
             * For each matching relayer, run processor if provided followed by send
             */
            for (const relayer of relayersForThisEvent) {
                try {
                    event.data = relayer.processor ?
                        await relayer.processor(event.data) : event.data;

                    if (relayer.processor) {
                        logger.debug(
                            `Successfully processed data with relayer ${relayer.name}'s processor`);
                    }
                } catch (e) {
                    const message = `Failed to processor data with relayer ${relayer.name}.  Error => ${e}`;
                    logger.error(message);
                    reject({ code: 1, message });
                }

                try {
                    await sendData(relayer, event.data, ctx);
                    logger.debug(`Successfully sent data with relayer ${relayer.name}`);
                } catch (e) {
                    const message = `Failed to send data with relayer ${relayer.name}.  Error => ${e}`;
                    logger.error(message);
                    reject({ code: 1, message });
                }
            }

            // Success
            resolve(Success);
        });
    }
}

/**
 * Based on the eventTarget type, use the appropriate transport to send data
 *
 * @param relayer
 * @param data
 * @param ctx
 */
async function sendData(relayer: EventRelayer, data: EventRelayData, ctx: HandlerContext): Promise<void> {
    // Process event based on targetEvent.eventType
    if (relayer.targetEvent.eventType === "public") {
        await sdmPostWebhook(
            relayer.targetEvent.eventTarget,
            relayer.targetEvent.headers ?
                await relayer.targetEvent.headers(ctx, data) : purgeCommonHeaders(data.headers as HttpClientOptions["headers"]),
            data.body,
        );
    } else if (relayer.targetEvent.eventType === "publicDynamic") {
        await sdmPostWebhook(
            await relayer.targetEvent.eventTarget(ctx, data),
            relayer.targetEvent.headers ?
                await relayer.targetEvent.headers(ctx, data) : purgeCommonHeaders(data.headers as HttpClientOptions["headers"]),
            data.body,
        );
    } else if (relayer.targetEvent.eventType === "private") {
        await ctx.messageClient.send(data.body, relayer.targetEvent.eventTarget);
    } else if (relayer.targetEvent.eventType === "privateDynamic") {
        await ctx.messageClient.send(data.body, await relayer.targetEvent.eventTarget(ctx));
    }
}

/**
 * Post data to an ingester webhook using httpClient from the SDM
 * @param {string | string[]} url The url to send data to
 * @param {any} payload Payload of data to send to the endpoint (object form; gets converted to JSON)
 * @param {HttpClientOptions["headers"]} headers
 */
async function sdmPostWebhook(
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
