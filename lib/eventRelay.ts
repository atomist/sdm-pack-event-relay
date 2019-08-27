import {Destination, HandlerContext, HttpClientOptions, logger} from "@atomist/automation-client";
import {ExtensionPack, metadata} from "@atomist/sdm";
import {EventRelayData} from "./event/eventRelay";
import {eventRelayPostProcessor} from "./support/customizer";
/**
 * Represents the destination for an event relayer
 *
 * An event is "public" when it's a type that is part of the Atomist API and doesn't rely
 * on a custom ingester (i.e., event type defined in an SDM).  A "private" event type is one that is added
 * via an SDM.
 *
 * Public types require an eventTarget to be set to the ingestion URL.  The event relayer will send these messages
 * via HTTPS to webhook.atomist.com.  You can optionally supply additional headers for public events that will be used
 * when posting data.  Examples of headers you may need to provide would be event type headers or auth information.
 *
 * Private types are sent over the internal SDM websocket.
 */
type EventRelayDestination<DATA> =
    /**
     * Use this variant for public targets with a static url list
     */
    | {
        eventType: "public",
        eventTarget: string | string[],
        headers?: (ctx: HandlerContext, payload: DATA) => HttpClientOptions["headers"],
    }
    /**
     * Use this variant for public targets with a url list that is dynamically built
     * allowing for GraphQL queries to lookup provider details
     */
    | {
        eventType: "publicDynamic",
        eventTarget: (ctx: HandlerContext, payload: DATA) => Promise<string[]>,
        headers?: (ctx: HandlerContext, payload: DATA) => HttpClientOptions["headers"],
    }
    /**
     * Use this variant for private targets with a static destination(s)
     */
    | {
        eventType: "private",
        eventTarget: Destination | Destination[],
    }
    /**
     * Use this variant for private targets with dynamic destinations
     */
    | {
        eventType: "privateDynamic",
        eventTarget: (ctx: HandlerContext) => Promise<Destination | Destination[]>,
    };

export interface EventRelayer<DATA = any> {
    /**
     * Label for this relayer
     */
    name: string;

    /**
     * Check if this payload is of the event type this Relayer expects
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
}

interface EventRelaySupportOptions {
    eventRelayers: Array<EventRelayer<any>>;
}

export const eventRelaySupport = (
    options: EventRelaySupportOptions,
): ExtensionPack => {
    return {
        ...metadata(),
        requiredConfigurationValues: [],
        configure: sdm => {
            sdm.configuration.sdm.eventRelayers = options.eventRelayers;
            eventRelayPostProcessor(sdm.configuration);
        },
    };
};
