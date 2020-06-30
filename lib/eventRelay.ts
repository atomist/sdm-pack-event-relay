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
  Destination,
  HandlerContext,
  HttpClientOptions,
} from "@atomist/automation-client";
import {
  ExtensionPack,
  metadata,
  SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
  EventRelayData,
  EventRelayHandler,
  EventRelayHandlerRemovingAutomationMetadataProcessor,
} from "./event/eventRelay";
import { eventRelayPostProcessor } from "./support/customizer";
import { apiKeyValidator } from "./support/util";

type EventTargetPublic<DATA> = (ctx: HandlerContext, payload: DATA) => Promise<string | string[]>;
type EventTargetPrivate<DATA> = (ctx: HandlerContext, payload: DATA) => Promise<Destination | Destination[]>;

// This interface is copy of ParsedQs in the qs package
interface QueryString { [key: string]: undefined | string | string[] | QueryString | QueryString[]; }

/**
 * This interface is used to describe the validator that is applied to incoming messages.  A validator can be used to
 * validate message payloads (digest) or used to implement authentication/authorization for incoming messages.
 *
 * Validation is not always just secret or user/pass combination.  You can use any of the data supplied to determine if
 * a message should be accepted or not.   "Accepted" means the return object has a `success` property set to true.   If
 * an incoming payload is not accepted it should have a `success` property value of false.  Optionally you can include a
 * message to return as part of the response.
 */
export interface Validator {
  name: string;
  /**
   * Handler used to actually validate if a message should be accepted or rejected
   *
   * @param headers HTTP Headers sent for this request
   * @param queryString HTTP Query string (if set)
   * @param payload HTTP POST body
   * @param config Configuration & SoftwareDeliveryMachineConfiguration
   */
  handler: (
    headers: Record<string, string | string[] | undefined>,
    queryString: QueryString,
    payload: any,
    config: Configuration & SoftwareDeliveryMachineConfiguration,
  ) => Promise<{ success: boolean; message?: string }>;
}

/**
 * Represents the destination for an event relayer
 *
 * An event is "public" when it's a type that is part of the Atomist API and doesn't rely
 * on a custom ingester (i.e., event type defined in an SDM).  A "private" event type is one that is added
 * via an SDM.
 *
 * Public types require an eventTarget to be set to the ingestion URL.  The event relayer will send these messages
 * via HTTPS to webhook.atomist.com.  You can optionally supply additional headers for public events that will be used
 * when posting data.  Examples of headers you may need to provide would be event type headers or auth information.  If
 * no headers function supplied the purgeCommonHeaders function will automatically be applied
 *
 * Private types are sent over the internal SDM websocket.
 */
type EventRelayDestination<DATA> =
    | {
        eventType: "public",
        eventTarget: string | string[] | EventTargetPublic<DATA>,
        headers?: (ctx: HandlerContext, payload: DATA) => HttpClientOptions["headers"],
    }
    | {
        eventType: "private",
        eventTarget: Destination | Destination[] | EventTargetPrivate<DATA>,
    };

/**
 * This interface describes the properties of an EventRelayer.
 *
 * There should only be 1 relayer for each data payload type. If multiple EventRelayer tests match the same payload
 * there will be a warning message and only the first match will be used.
 */
export interface EventRelayer<DATA = any> {
    /**
     * Label for this relayer
     */
    name: string;

    /**
     * Check if this payload is of the event type this Relayer expects.
     * @param payload
     */
    test: (payload: EventRelayData<DATA>) => boolean;

    /**
     * Target Event
     */
    targetEvent: EventRelayDestination<EventRelayData<DATA>>;

    /**
     * Optionally supply a processor to modify data prior to relay
     */
    processor?: (payload: EventRelayData<DATA>) => Promise<EventRelayData<DATA>>;

    /**
     * Optionally supply a custom validator for this relayer.  If not supplied the default validator is used (or the
     * validator supplied to the extension pack).
     */
    validator?: Validator;
}

interface EventRelaySupportOptions {
    eventRelayers: Array<EventRelayer<any>>;

    /**
     * Which validator should be used to authenticate/validate incoming messages if not supplied on the matching
     * relayer.
     *
     * Defaults to apiKey if not set.
     */
    validation?: Validator;
}

export const eventRelaySupport = (
    options: EventRelaySupportOptions,
): ExtensionPack => {
    return {
        ...metadata(),
        requiredConfigurationValues: [],
        configure: sdm => {
            sdm.configuration.sdm.eventRelayers = options.eventRelayers;
            sdm.configuration.metadataProcessor = new EventRelayHandlerRemovingAutomationMetadataProcessor();
            sdm.addEvent(EventRelayHandler);
            eventRelayPostProcessor(sdm.configuration, options.validation === undefined ? apiKeyValidator : options.validation);
        },
    };
};
