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

import { HandlerContext } from "@atomist/automation-client";
import { EventRelayData } from "../event/eventRelay";
import { EventRelayer } from "../eventRelay";
import {
    purgeCommonHeaders,
    sdmPostWebhook,
} from "./util";

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
