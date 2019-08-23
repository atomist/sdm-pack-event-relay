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

import {
    addressEvent,
    automationClientInstance,
    Configuration, guid, Issue,
} from "@atomist/automation-client";
import {
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
    configureSdm,
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";
import {EventRelayer, eventRelaySupport} from "../lib/eventRelay";
import {eventRelayPostProcessor} from "../lib/support/customizer";

export function machineMaker(config: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine(
        {
            name: `${configuration.name}-test`,
            configuration: config,
        },
    );

    interface TestScrubber {
        user: {
            displayName: string,
        };
    }

    const test: EventRelayer<TestScrubber> = {
            name: "jiraReplayer",
            test: payload => {
                return payload.hasOwnProperty("webhookEvent") && payload.hasOwnProperty("issue_event_type_name");
            },
            targetEvent: {
                // eventType: "public",
                // eventTarget: ["foobar"],
                eventType: "private",
                eventTarget: addressEvent("JiraIssue"),
                // eventTarget: async ctx => ({userAgent: ctx.workspaceId}),
            },
            scrubber: async issue => {
               issue.user.displayName = guid();
               return issue;
            },

    };
    sdm.addExtensionPacks(
        eventRelaySupport({
            eventRelayers: [
                test,
            ],
        }),
    );

    return sdm;
}

export const configuration: Configuration = {
    postProcessors: [
        configureSdm(machineMaker),
        eventRelayPostProcessor,
    ],
};
