import {Destination, HandlerContext} from "@atomist/automation-client";
import {ExtensionPack, metadata} from "@atomist/sdm";

/**
 * Represents the destination for an event relayer
 *
 * An event is "public" when it's a type that is part of the Atomist API and doesn't rely
 * on a custom ingester (i.e., event type defined in an SDM).  A "private" event type is one that is added
 * via an SDM.
 *
 * Public types require an eventTarget to be set to the ingestion URL.  The event relayer will send these messages
 * via HTTPS to webhooks.atomist.com.
 */
type EventRelayDestination =
    /**
     * Use this variant for public targets with a static url list
     */
    | {
        eventType: "public",
        eventTarget: string | string[],
    }
    /**
     * Use this variant for public targets with a url list that is dynamically built
     * allowing for GraphQL queries to lookup provider details
     */
    | {
        eventType: "publicDynamic",
        eventTarget: (ctx: HandlerContext) => Promise<string[]>,
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
    test: (payload: DATA) => boolean;

    /**
     * Target Event
     */
    targetEvent: EventRelayDestination;

    /**
     * Optionally supply a scrubber to munge data prior to relay
     */
    scrubber?: (data: DATA) => Promise<DATA>;
}

interface EventRelaySupportOptions {
    eventRelayers: EventRelayer[];
}

export const eventRelaySupport = (
    options: EventRelaySupportOptions,
): ExtensionPack => {
    return {
        ...metadata(),
        requiredConfigurationValues: [],
        configure: sdm => {
            sdm.configuration.sdm.eventRelayers = options.eventRelayers;
        },
    };
}
