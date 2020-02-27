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

/**
 * Post-processor that exposes a /event endpoint on the SDM that can be used as a webhook target.
 * The post processor then formats the data and sends on to the required endpoint.
 *
 * @param {Configuration} config sdm configuration
 */
import {
    automationClientInstance,
    Configuration,
    EventIncoming,
    guid,
    logger,
} from "@atomist/automation-client";
import { SoftwareDeliveryMachineConfiguration } from "@atomist/sdm";
import { EventRelayHandler } from "../event/eventRelay";
import { EventRelayer } from "../eventRelay";

export function eventRelayPostProcessor(config: Configuration & SoftwareDeliveryMachineConfiguration, authRequired: boolean): void {
    config.http.customizers.push(
        c => {
            let registered = false;
            logger.debug(`EventRelayers registered: ` +
                config.sdm.eventRelayers.map((r: EventRelayer) => r.name).join(", "),
            );

            c.post("/relay", async (req, res) => {
                if (authRequired) {
                    if (req.get("authorization")) {
                        if (!(req.get("authorization").split(" ")[1] === config.apiKey)) {
                            res.status(401);
                            return res.send({
                                success: false,
                                message: "Unrecognized API Key",
                            });
                        }
                    } else {
                        res.status(401);
                        return res.send({
                            success: false,
                            message: "Unauthorized.  Must supply token",
                        });
                    }
                }
                const data: EventIncoming = {
                    data: {
                        body: req.body,
                        headers: req.headers,
                    },
                    extensions: {
                        operationName: "EventRelayHandler",
                        team_id: config.workspaceIds[0],
                        correlation_id: guid(),
                    },
                    secrets: [],
                };

                if (!registered) {
                    automationClientInstance().withEventHandler(() => new EventRelayHandler());
                    registered = true;
                }

                automationClientInstance().webSocketHandler.processEvent(data);
                return res.send({success: true, message: "Payload submitted to be relayed"});
            });
        },
    );
}
