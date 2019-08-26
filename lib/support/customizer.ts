/**
 * Post-processor that exposes a /event endpoint on the SDM that can be used as a webhook target.
 * The post processor then formats the data and sends on to the required endpoint.
 *
 * @param {Configuration} config sdm configuration
 */
import {
    automationClientInstance,
    Configuration,
    EventIncoming, guid, logger,
} from "@atomist/automation-client";
import {SoftwareDeliveryMachineConfiguration} from "@atomist/sdm";
import {EventRelayHandler} from "../event/eventRelay";
import {EventRelayer} from "../eventRelay";

export function eventRelayPostProcessor(config: Configuration & SoftwareDeliveryMachineConfiguration): void {
    config.http.customizers.push(
        c => {
            let registered = false;
            logger.debug(`EventRelayers registered: ` +
                config.sdm.eventRelayers.map((r: EventRelayer) => r.name).join(", "),
            );

            c.post("/relay", async (req, res) => {
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
