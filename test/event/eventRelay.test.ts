import {
    EventIncoming,
    guid,
} from "@atomist/automation-client";
import { fakeContext } from "@atomist/sdm";
import * as assert from "power-assert";
import * as sinon from "sinon";
import { EventRelayHandler } from "../../lib/event/eventRelay";
import * as sendData from "../../lib/support/sendData";
import {
    createFakeRelay,
    fakeHeaders,
} from "../testUtils/fakeRelayer.test";

const testEventData: EventIncoming = {
    data: {
        body: { eventKey: "test", actor: "test", date: "test"},
        headers: { ...fakeHeaders, "x-event-key": "testEventData" },
    },
    extensions: {
        operationName: "EventRelayHandler",
        team_id: "T123",
        correlation_id: guid(),
    },
    secrets: [],
};

describe("EventRelayHandler", async () => {
    let sandbox: sinon.SinonSandbox;
    before(() => {
        sandbox = sinon.createSandbox();
    });
    after(() => {
        sandbox.reset();
        sandbox.restore();
    });
    afterEach(() => {
        delete (global as any).__runningAutomationClient;
    });
    it("should find relevant relayers and call sendData", async () => {
        // Setup Relayers and spies
        const wontRunRelayer = createFakeRelay("publicStatic");
        wontRunRelayer.test = () => false;
        wontRunRelayer.name = "wontRunRelayer";

        const relayers = [
            createFakeRelay("publicStatic"),
            wontRunRelayer,
        ];
        const shouldRunRelayerTest = sandbox.spy(relayers[0], "test");
        const shouldRunRelayerProcessor = sandbox.spy(relayers[0], "processor");
        const shouldNotRunRelayerProcessor = sandbox.spy(relayers[1], "processor");

        // Add Relayers to config
        (global as any).__runningAutomationClient = {
            configuration: {
                sdm: {
                    eventRelayers: relayers,
                },
            },
        };

        // Stub out send data
        const sD = sandbox.stub(sendData, "sendData");
        sD.returns(Promise.resolve(undefined));

        // Setup fake context
        const context = fakeContext();

        // Setup stub for sendData
        await new EventRelayHandler().handle(testEventData, context);
        sD.restore();

        // Validate matching relayers were called, unmatching were not, and that sendData got called
        assert(shouldRunRelayerTest.calledOnce);
        assert(shouldRunRelayerProcessor.calledOnce);
        assert(shouldNotRunRelayerProcessor.notCalled);
        assert(sD.calledOnce);
    });
    it("should not call sendData if not relayers tests pass", async () => {
        // Setup Relayers and spies
        const wontRunRelayer = createFakeRelay("publicStatic");
        wontRunRelayer.test = () => false;
        wontRunRelayer.name = "wontRunRelayer";
        const wontRunRelayer1 = createFakeRelay("publicStatic");
        wontRunRelayer1.test = () => false;
        wontRunRelayer1.name = "wontRunRelayer";

        const relayers = [
            wontRunRelayer,
            wontRunRelayer1,
        ];

        // Add Relayers to config
        (global as any).__runningAutomationClient = {
            configuration: {
                sdm: {
                    eventRelayers: relayers,
                },
            },
        };

        // Stub out send data
        const sD = sandbox.stub(sendData, "sendData");
        sD.returns(Promise.resolve(undefined));

        // Setup fake context
        const context = fakeContext();

        // Setup stub for sendData
        await new EventRelayHandler().handle(testEventData, context);
        sD.restore();

        // Validate sendData was not called since no relayers match
        assert(sD.notCalled);
    });
    it("should call data processor if present on relayer", async () => {
        // Setup Relayers and spies
        const relayer1 = createFakeRelay("publicStatic");
        const processor = sandbox.spy(relayer1, "processor");

        const relayers = [
            relayer1,
        ];

        // Add Relayers to config
        (global as any).__runningAutomationClient = {
            configuration: {
                sdm: {
                    eventRelayers: relayers,
                },
            },
        };

        // Stub out send data
        const sD = sandbox.stub(sendData, "sendData");
        sD.returns(Promise.resolve(undefined));

        // Setup fake context
        const context = fakeContext();

        // Setup stub for sendData
        await new EventRelayHandler().handle(testEventData, context);
        sD.restore();

        // Validate sendData was not called since no relayers match
        assert(processor.calledOnce);
        const arg = sD.args[0];
        assert(Object.keys(arg[1].body).includes("x-fakerelay-type"));
        assert.strictEqual(arg[1].body["x-fakerelay-type"], arg[1].headers["x-event-key"]);
    });
});
