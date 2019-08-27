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
    Configuration, guid,
    HttpClientOptions,
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
import {addAtomistSignatureHeader, purgeCommonHeaders} from "../lib/support/util";

export function machineMaker(config: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine(
        {
            name: `${configuration.name}-test`,
            configuration: config,
        },
    );

    interface BitbucketTestData {
        eventKey: string;
        actor: any;
        date: string;
    }
    const bitbucketRelay: EventRelayer<BitbucketTestData> = {
        name: "bitbucketRelay",
        test: payload => !!payload.body.actor && !!payload.body.date && !!payload.body.eventKey,
        processor: async payload => {
            // "x-github-event"
            (payload.body as any)["x-bitbucket-type"] = payload.headers["x-event-key"];
            // (payload.body as any)["x-bitbucket-type"] = payload.headers["x-request-id"];
            return {body: payload.body, headers: payload.headers};
        },
        targetEvent: {
            eventType: "public",
            eventTarget: sdm.configuration.sdm.git.webhookdest,
        },
    };

    /**
     * Message digest variant
     */
    // const bitbucketRelay: EventRelayer<BitbucketTestData> = {
    //     name: "bitbucketRelay",
    //     test: payload => !!payload.body.actor && !!payload.body.date && !!payload.body.eventKey,
    //     processor: async payload => {
    //         // "x-github-event"
    //         (payload.body as any)["x-bitbucket-type"] = payload.headers["x-request-id"];
    //         return {body: payload.body, headers: payload.headers};
    //     },
    //     targetEvent: {
    //         eventType: "public",
    //         eventTarget: sdm.configuration.sdm.git.webhookdest,
    //         headers: (ctx, payload) => {
    //             payload.headers = addAtomistSignatureHeader(
    //                 sdm.configuration.sdm.git.key,
    //                 payload.body,
    //                 payload.headers as HttpClientOptions["headers"],
    //             );
    //             return payload.headers as HttpClientOptions["headers"];
    //         },
    //     },
    // };

    /**
     * Define a test EventRelayer and Processor
     */
    interface TestJiraData {
        webhookEvent: string;
        issue_event_type_name: string;
        user: {
            displayName: string,
        };
    }

    const testJiraRelay: EventRelayer<TestJiraData> = {
            name: "jiraReplayer",
            test: payload => {
                return !!payload.body.webhookEvent && !!payload.body.issue_event_type_name;
            },
            targetEvent: {
                eventType: "private",
                eventTarget: addressEvent("JiraIssue"),
            },
            processor: async issue => {
               issue.body.user.displayName = guid();
               return issue;
            },
    };

    /**
     * Register Ext pack
     */
    sdm.addExtensionPacks(
        eventRelaySupport({
            eventRelayers: [
                testJiraRelay,
                bitbucketRelay,
            ],
        }),
    );

    return sdm;
}

export const configuration: Configuration = {
    postProcessors: [
        configureSdm(machineMaker),
    ],
};
