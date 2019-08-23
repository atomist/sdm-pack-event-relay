/**
 * Post-processor that exposes a /event endpoint on the SDM that can be used as a webhook target.
 * The post processor then formats the data and sends on to the required endpoint.
 *
 * @param {Configuration} config sdm configuration
 */
import {
    automationClientInstance,
    Configuration,
    ConfigurationPostProcessor,
    EventIncoming, guid, logger,
} from "@atomist/automation-client";
import * as bodyParser from "body-parser";
import {EventRelayHandler} from "../event/eventRelay";

export const eventRelayPostProcessor: ConfigurationPostProcessor = async (config: Configuration) => {
    config.http.customizers.push(
        c => {
            c.use(bodyParser.urlencoded({extended: true}));
            c.use(bodyParser.json());
            let registered = false;

            c.post("/relay", async (req, res) => {
                const data: EventIncoming = {
                    data: req.body,
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
                res.send({state: "success", message_delivered: true});
            });
        },
    );
    return config;
};
