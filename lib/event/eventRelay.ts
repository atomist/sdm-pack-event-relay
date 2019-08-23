import {
    Configuration,
    configurationValue,
    EventFired,
    HandlerContext,
    HandlerResult, HttpMethod,
    logger,
    SuccessPromise,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {toArray} from "@atomist/sdm-core/lib/util/misc/array";
import {EventRelayer} from "../eventRelay";

// TODO: I don't want a graphQL subscription here, but it have to have it or I get errors
@EventHandler("Handle eventRelay events", "subscription Placeholder { HerokuApp { app } }")
export class EventRelayHandler implements HandleEvent<any> {
    public handle(event: EventFired<any>, ctx: HandlerContext): Promise<HandlerResult> {
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

        /**
         * For each matching relayer, run scrubber if provided followed by send
         */
        for (const relayer of relayersForThisEvent) {
            if (relayer.scrubber) {
                relayer.scrubber(event.data)
                    .then(async res => {
                        try {
                            await sendData(relayer, res, ctx);
                            logger.debug(`Successfully sent data for relayer ${relayer.name}`);
                        } catch (e) {
                            const message = `Failed to send data for relayer ${relayer.name}.  Error => ${e}`;
                            logger.error(message);
                            return { code: 1, message };
                        }
                        return {code: 0};
                    })
                    .catch(e => {
                        const message = `Failed to run data scrubber for relyaer ${relayer.name}.  Error => ${e}`;
                        logger.error(message);
                        return { code: 1, message };
                    });
            } else {
                sendData(relayer, event.data, ctx)
                    .then(() => {
                        logger.debug(`Successfull sent data for relayer ${relayer.name}`);
                    })
                    .catch(e => {
                        const message = `Failed to run data scrubber for relyaer ${relayer.name}.  Error => ${e}`;
                        logger.error(message);
                        return { code: 1, message };
                    });
            }
        }
        return SuccessPromise;
    }
}

/**
 * Based on the eventTarget type, use the appropriate transport to send data
 *
 * @param relayer
 * @param data
 * @param ctx
 */
async function sendData(relayer: EventRelayer, data: any, ctx: HandlerContext): Promise<void> {
    if (relayer.targetEvent.eventType === "public") {
        await sdmPostWebhook(relayer.targetEvent.eventTarget, data);
    } else if (relayer.targetEvent.eventType === "publicDynamic") {
        await sdmPostWebhook(await relayer.targetEvent.eventTarget(ctx), data);
    } else if (relayer.targetEvent.eventType === "private") {
        await ctx.messageClient.send(data, relayer.targetEvent.eventTarget);
    } else if (relayer.targetEvent.eventType === "privateDynamic") {
        await ctx.messageClient.send(data, await relayer.targetEvent.eventTarget(ctx));
    }
}

/**
 * Post data to an ingester webhook using httpClient from the SDM
 * @param url The url to send data to
 * @param payload Payload of data to send to the endpoint (object form; gets converted to JSON)
 */
async function sdmPostWebhook(url: string[] | string, payload: any): Promise<void> {
    const config = configurationValue<Configuration>();

    try {
        for (const dest of toArray(url)) {
            const httpClient = config.http.client.factory.create(dest);
            const result = await httpClient.exchange(
                dest, {
                    method: HttpMethod.Post,
                    body: JSON.stringify(payload),
                    headers: { ["Content-Type"]: "application/json" },
                });
            logger.debug(`sdmPostWebhook Result: ${JSON.stringify(result)}`);
        }
    } catch (e) {
        logger.error("sdmPostWebhook:  Error! Failed to send webhook.  Failure: " + e.message);
        throw new Error(e);
    }
}
