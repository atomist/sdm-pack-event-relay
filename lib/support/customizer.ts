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
import { Validator } from "./util";

export function eventRelayPostProcessor(config: Configuration & SoftwareDeliveryMachineConfiguration, validation: Validator): void {
    config.http.customizers.push(
        c => {
            logger.debug(`EventRelayers registered: ` +
                config.sdm.eventRelayers.map((r: EventRelayer) => r.name).join(", "),
            );
            logger.debug(`EventRelayer: Using validator ${validation.name} on incoming messages`);

            c.post(["/relay", "/relay/:team"], async (req, res) => {
                const result = await validation.handler(req.headers, req.body, config);
                const team = req.params.team ? req.params.team : config.workspaceIds[0];

                if (!result.success) {
                    res.status(401);
                    return res.send(result);
                }
                const data: EventIncoming = {
                    data: {
                        body: req.body,
                        headers: req.headers,
                    },
                    extensions: {
                        operationName: EventRelayHandler.name,
                        team_id: team.toUpperCase(),
                        correlation_id: guid(),
                    },
                    secrets: [],
                };

                automationClientInstance().webSocketHandler.processEvent(data);
                return res.send({success: true, message: "Payload submitted to be relayed"});
            });
        },
    );
}
