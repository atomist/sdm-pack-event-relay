import { addressEvent } from "@atomist/automation-client";
import { EventRelayer } from "../../lib/eventRelay";

export const fakeHeaders: Record<string, string> = {
    "host": "fakehost.com",
    "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "expect": "100-continue",
    "content-length": "1024",
    "user-agent": "fake useragent",
    "accept": "application/json",
};

export interface FakeRelayerTestData {
    eventKey: string;
    actor: any;
    date: string;
}

const publicStaticTargetEvent = {
    eventType: "public",
    eventTarget: "fake.dest.com/T123/dest",
};
const publicDynamicTargetEvent: EventRelayer<FakeRelayerTestData>["targetEvent"] = {
    eventType: "public",
    eventTarget: async (ctx, payload)  => {
        return "fake.dest.com/T123/dest";
    },
};
const publicDynamicTargetEventMultiple: EventRelayer<FakeRelayerTestData>["targetEvent"] = {
    eventType: "public",
    eventTarget: async (ctx, payload)  => {
        return [ "fake.dest1.com/T123/dest", "fake.dest2.com/T123/dest"];
    },
};
const privateStaticTargetEvent: EventRelayer<FakeRelayerTestData>["targetEvent"] = {
    eventType: "private",
    eventTarget: addressEvent("fake"),
};
const privateStaticTargetEventMultiple: EventRelayer<FakeRelayerTestData>["targetEvent"] = {
    eventType: "private",
    eventTarget: [
        addressEvent("fake1"),
        addressEvent("fake2"),
    ],
};
const privateDynamicTargetEvent: EventRelayer<FakeRelayerTestData>["targetEvent"] = {
    eventType: "private",
    eventTarget: async (ctx, payload)  => {
        return addressEvent("fake");
    },
};
const privateDynamicTargetEventMultiple: EventRelayer<FakeRelayerTestData>["targetEvent"] = {
    eventType: "private",
    eventTarget: async (ctx, payload)  => {
        return [
            addressEvent("fake1"),
            addressEvent("fake2"),
        ];
    },
};

export function createFakeRelay(
    type:
        "publicStatic" |
        "publicDynamic" |
        "publicDynamicMultiple" |
        "privateStatic" |
        "privateStaticMultiple" |
        "privateDynamic" |
        "privateDynamicMultiple",
): EventRelayer<FakeRelayerTestData> {
    let targetEvent: any;
    if (type === "publicStatic") {
        targetEvent = publicStaticTargetEvent;
    } else if (type === "publicDynamic") {
        targetEvent = publicDynamicTargetEvent;
    } else if (type === "publicDynamicMultiple") {
        targetEvent = publicDynamicTargetEventMultiple;
    } else if (type === "privateStatic") {
        targetEvent = privateStaticTargetEvent;
    } else if (type === "privateStaticMultiple") {
        targetEvent = privateStaticTargetEventMultiple;
    } else if (type === "privateDynamic") {
        targetEvent = privateDynamicTargetEvent;
    } else if (type === "privateDynamicMultiple") {
        targetEvent = privateDynamicTargetEventMultiple;
    }

    return {
        name: "fakeRelay",
        test: payload => true,
        processor: async payload => {
            (payload.body as any)["x-fakerelay-type"] = payload.headers["x-event-key"];
            return {body: payload.body, headers: payload.headers};
        },
        targetEvent,
    };
}
