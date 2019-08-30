import * as autoClient from "@atomist/automation-client";
import { fakeContext } from "@atomist/sdm";
import * as assert from "power-assert";
import * as sinon from "sinon";
import { EventRelayData } from "../../lib/event/eventRelay";
import { sendData } from "../../lib/support/sendData";
import * as util from "../../lib/support/util";
import {
    createFakeRelay,
    fakeHeaders,
    FakeRelayerTestData,
} from "../testUtils/fakeRelayer.test";

// Create an event body
const data: EventRelayData<FakeRelayerTestData> = {
    body: { eventKey: "test", actor: "test", date: "test"},
    headers: fakeHeaders,
};

describe ("sendEvent", () => {
    let sandbox: sinon.SinonSandbox;
    before(() => {
        sandbox = sinon.createSandbox();
    });
    after(() => {
        sandbox.reset();
        sandbox.restore();
    });
    describe("public events", () => {
        it("should call sdmPostWebhook when a dynamic destination is provided", async () => {
            const a = sandbox.stub(util, "sdmPostWebhook");
            a.returns(undefined);
            const ctx = fakeContext();
            await sendData(createFakeRelay("publicDynamic"), data, ctx);
            a.restore();
            assert(a.calledOnce);
            const args = a.getCall(0).args;
            assert.strictEqual(typeof args[0], "string");
            assert.strictEqual(args[0], "fake.dest.com/T123/dest");
        });
        it("should call sdmPostWebhook when a static destination is provided", async () => {
            const a = sandbox.stub(util, "sdmPostWebhook");
            a.returns(undefined);
            const ctx = fakeContext();
            const r = createFakeRelay("publicStatic");
            await sendData(r, data, ctx);
            a.restore();
            assert(a.calledOnce);
            const args = a.getCall(0).args;
            assert.strictEqual(typeof args[0], "string");
            assert.strictEqual(args[0], "fake.dest.com/T123/dest");
        });
        it("should preserve custom headers", async () => {
            const a = sandbox.stub(util, "sdmPostWebhook");
            a.returns(undefined);
            const ctx = fakeContext();
            const newData = { ...data };
            newData.headers = {
                ...fakeHeaders,
                testHeader: "value",
            };
            await sendData(createFakeRelay("publicStatic"), newData, ctx);
            a.restore();
            const res = a.getCall(0).args[1];
            assert(res.hasOwnProperty("testHeader"));
            assert(Object.keys(res).length === 1);
        });
        it("should purge common undesirable headers if no custom header function is provided", async () => {
            const a = sandbox.stub(util, "sdmPostWebhook");
            a.returns(undefined);
            const ctx = fakeContext();
            await sendData(createFakeRelay("publicStatic"), data, ctx);
            a.restore();
            const res = a.getCall(0).args[1];
            assert(
                !res.hasOwnProperty("authorization") &&
                !res.hasOwnProperty("accept") &&
                !res.hasOwnProperty("host") &&
                !res.hasOwnProperty("expect") &&
                !res.hasOwnProperty("content-length") &&
                !res.hasOwnProperty("user-agent"),
            );
        });
        it("should not modify headers if custom header function is provided", async () => {
            const a = sandbox.stub(util, "sdmPostWebhook");
            a.returns(undefined);
            const ctx = fakeContext();
            const relay = createFakeRelay("publicStatic");
            (relay.targetEvent as any).headers = (c: any, payload: any) => payload.headers;
            await sendData(relay, data, ctx);
            a.restore();
            const res = a.getCall(0).args[1];
            assert(res === fakeHeaders);
        });
    });
    describe("private events", () => {
        it("should call messageClient for single static destination", async () => {
            const ctx = fakeContext();
            const a = sandbox.stub(ctx.messageClient, "send");
            a.returns(undefined);
            await sendData(createFakeRelay("privateStatic"), data, ctx);
            a.restore();
            assert(a.calledOnce);
            const args = a.getCall(0).args;
            assert(args[1].hasOwnProperty("userAgent"));
        });
        it("should call messageClient once for multiple static destination", async () => {
            const ctx = fakeContext();
            const a = sandbox.stub(ctx.messageClient, "send");
            a.returns(undefined);
            await sendData(createFakeRelay("privateStaticMultiple"), data, ctx);
            a.restore();

            // Validate it was called with multiple destinations
            const args = a.getCall(0).args;
            assert((args[1] as autoClient.Destination[]).filter(arg => arg.hasOwnProperty("userAgent")).length === 2);

            // Validate send was called just once
            assert(a.calledOnce);
        });
        it("should call messageClient for single dynamic destination", async () => {
            const ctx = fakeContext();
            const a = sandbox.stub(ctx.messageClient, "send");
            a.returns(undefined);
            await sendData(createFakeRelay("privateDynamic"), data, ctx);
            a.restore();
            assert(a.calledOnce);
            const args = a.getCall(0).args;
            assert(args[1].hasOwnProperty("userAgent"));
        });
        it("should call messageClient once for multiple dynamic destinations", async () => {
            const ctx = fakeContext();
            const a = sandbox.stub(ctx.messageClient, "send");
            a.returns(undefined);
            await sendData(createFakeRelay("privateDynamicMultiple"), data, ctx);
            a.restore();

            // Validate it was called with multiple destinations
            const args = a.getCall(0).args;
            assert((args[1] as autoClient.Destination[]).filter(arg => arg.hasOwnProperty("userAgent")).length === 2);

            // Validate send was called just once
            assert(a.calledOnce);
        });
    });
});
