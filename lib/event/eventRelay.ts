/*
 * Copyright © 2019 Atomist, Inc.
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
    logger,
    Success,
} from "@atomist/automation-client";
import { isEventHandlerMetadata } from "@atomist/automation-client/lib/internal/metadata/metadata";
import { AutomationMetadata } from "@atomist/automation-client/lib/metadata/automationMetadata";
import { AutomationMetadataProcessor } from "@atomist/automation-client/lib/spi/env/MetadataProcessor";
import { EventHandlerRegistration } from "@atomist/sdm";
import { EventRelayer } from "../eventRelay";
import { sendData } from "../support/sendData";

export interface EventRelayData<DATA = any> {
    body: DATA;
    headers: Record<string, string>;
}

export class EventRelayHandlerRemovingAutomationMetadataProcessor implements AutomationMetadataProcessor {

    public process<T extends AutomationMetadata>(md: T, configuration: Configuration): T {
        if (isEventHandlerMetadata(md) && md.name === EventRelayHandler.name) {
            md.expose = false;
        }
        return md;
    }
}

export const EventRelayHandler: EventHandlerRegistration<EventRelayData> = {
    name: "EventRelayHandler",
    description: "Handle eventRelay events",
    subscription: "subscription PlaceHolder { ok }",
    listener: async (event, ctx) => {

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
            return Success;
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
                return { code: 1, message };
            }

            try {
                await sendData(relayer, event.data, ctx);
                logger.debug(`Successfully sent data with relayer ${relayer.name}`);
            } catch (e) {
                const message = `Failed to send data with relayer ${relayer.name}.  Error => ${e}`;
                logger.error(message);
                return { code: 1, message };
            }
        }
        return Success;
    },
};
