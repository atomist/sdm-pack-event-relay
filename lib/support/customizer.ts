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
import { EventRelayer, Validator } from "../eventRelay";

export function eventRelayPostProcessor(
  config: Configuration & SoftwareDeliveryMachineConfiguration,
  validation: Validator,
): void {
  config.http.customizers.push(c => {
    const relayers = config.sdm.eventRelayers;
    logger.debug(
      `EventRelayers registered: ` +
        relayers.map((r: EventRelayer) => r.name).join(", "),
    );

    c.post(["/relay", "/relay/:team"], async (req, res) => {
      /**
       * Format data for processing by the SDM event loop
       */
      const team = req.params.team ? req.params.team : config.workspaceIds[0];
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

      /**
       * For each relayer, run provided test to see if it's a match; store the ones that are
       */
      const relayersForThisEvent: EventRelayer[] = [];
      try {
        for (const r of relayers) {
          if (r.test(data.data)) {
            relayersForThisEvent.push(r);
          }
        }
      } catch (e) {
        logger.error(`Failed to determine matching relayers for event, error recieved: ${e}`);
        res.status(500);
        return res.send({success: false, message: "internal server error"});
      }

      /**
       * There should only be relayer for each data type.  If there is more then one select
       */
      let validator: Validator;
      if (relayersForThisEvent.length === 0) {
        res.status(500);
        return res.send({success: false, message: "No relayers found for this data payload."});
      } else if (relayersForThisEvent.length > 1) {
        logger.warn(`More then one event relayer found for incoming payload! ` +
                    `Using first relayer ${relayersForThisEvent[0].name}. ` +
                    `Others found ${relayersForThisEvent.slice(1).map(r => r.name).join(",")}.`);
        validator = relayersForThisEvent[0].validator || validation;
      } else {
        validator = relayersForThisEvent[0].validator || validation;
      }

      logger.debug( `EventRelayer[${relayersForThisEvent[0].name}]: Using validator [${validator.name}] on incoming message`);
      const result = await validator.handler(req.headers, req.query, req.body, config);
      if (!result.success) {
        logger.warn(`EventRelayer[${relayersForThisEvent[0].name}]: ` +
                    `Failed to validate message from source [${req.ip}]. (validator: ${validator.name})`);
        res.status(401);
        return res.send(result);
      }

      automationClientInstance().webSocketHandler.processEvent(data);
      return res.send({
        success: true,
        message: "Payload submitted to be relayed",
      });
    });
  });
}
