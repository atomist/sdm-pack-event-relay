import {HandlerContext} from "@atomist/automation-client";
import {EventRelayData} from "../event/eventRelay";
import {EventRelayer} from "../eventRelay";
import {purgeCommonHeaders, sdmPostWebhook} from "./util";

/**
 * Based on the eventTarget type, use the appropriate transport to send data
 *
 * @param relayer
 * @param data
 * @param ctx
 */
export async function sendData(relayer: EventRelayer, data: EventRelayData, ctx: HandlerContext): Promise<void> {
    // Process event based on targetEvent.eventType
    if (relayer.targetEvent.eventType === "public") {
        await sdmPostWebhook(
            typeof relayer.targetEvent.eventTarget === "string" || Array.isArray(relayer.targetEvent.eventTarget) ?
                relayer.targetEvent.eventTarget : await relayer.targetEvent.eventTarget(ctx, data),
            relayer.targetEvent.headers ?
                relayer.targetEvent.headers(ctx, data) : purgeCommonHeaders(data.headers),
            data.body,
        );
    } else if (relayer.targetEvent.eventType === "private") {
        await ctx.messageClient.send(
            data.body,
            typeof relayer.targetEvent.eventTarget === "object" || Array.isArray(relayer.targetEvent.eventTarget)
                ? relayer.targetEvent.eventTarget : await relayer.targetEvent.eventTarget(ctx, data),
        );
    }
}
