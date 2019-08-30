import {
    configurationValue,
    EventFired,
    HandlerContext,
    HandlerResult,
    logger,
    Success,
} from "@atomist/automation-client";
import {EventHandler} from "@atomist/automation-client/lib/decorators";
import {HandleEvent} from "@atomist/automation-client/lib/HandleEvent";
import {EventRelayer} from "../eventRelay";
import {sendData} from "../support/sendData";

export interface EventRelayData<DATA = any> {
    body: DATA;
    headers: Record<string, string>;
}

@EventHandler("Handle eventRelay events", "subscription Placeholder { ok }")
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
