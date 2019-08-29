import {Destination} from "@atomist/automation-client";
import * as autoClient from "@atomist/automation-client";
import {fakeContext} from "@atomist/sdm";
import * as assert from "power-assert";
import * as sinon from "sinon";
import {EventRelayData, sendData} from "../../lib/event/eventRelay";
import * as util from "../../lib/support/util";
import * as fakeHttpClients from "../utils/fakeHttpFactor.test";
import {createFakeRelay} from "../utils/fakeRelayer.test";

interface FakeTestData {
    foo: string;
    bar: string;
}

const fakeHeaders: autoClient.HttpClientOptions["headers"] = {
    "host": "fakehost.com",
    "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "expect": "100-continue",
    "content-length": "1024",
    "user-agent": "fake useragent",
    "accept": "application/json",
};

// Create an event body
const data: EventRelayData<FakeTestData> = {
    body: { foo: "yea", bar: "fake data"},
    headers: fakeHeaders,
};

describe ("sendEvent", () => {
    describe("public events", () => {
        it("should call sdmPostWebhook when a static destination is provided", async () => {
            const a = sinon.stub(util, "sdmPostWebhook");
            a.returns(undefined);
            const ctx = fakeContext();
            await sendData(createFakeRelay("publicStatic"), data, ctx);
            a.restore();
            assert(a.calledOnce);
            const args = a.getCall(0).args;
            assert.strictEqual(typeof args[0], "string");
            assert.strictEqual(args[0], "fake.dest.com/T123/dest");
        });
        it("should call sdmPostWebhook when a dynamic destination is provided", async () => {
            const a = sinon.stub(util, "sdmPostWebhook");
            a.returns(undefined);
            const ctx = fakeContext();
            await sendData(createFakeRelay("publicDynamic"), data, ctx);
            a.restore();
            assert(a.calledOnce);
            const args = a.getCall(0).args;
            assert.strictEqual(typeof args[0], "string");
            assert.strictEqual(args[0], "fake.dest.com/T123/dest");
        });
        it("should preserve custom headers", async () => {
            const a = sinon.stub(util, "sdmPostWebhook");
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
            const a = sinon.stub(util, "sdmPostWebhook");
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
            const a = sinon.stub(util, "sdmPostWebhook");
            a.returns(undefined);
            const ctx = fakeContext();
            const relay = createFakeRelay("publicStatic");
            (relay.targetEvent as any).headers = (c: any, payload: any) => payload.headers;
            await sendData(relay, data, ctx);
            a.restore();
            const res = a.getCall(0).args[1];
            assert(res === fakeHeaders);
        });
        it("should call sdmPostWebhook multiple times when multiple destinations are configured", async () => {
            // Create a stub for configurationValue that returns a fake http client and set a spy on the client exchange function
            const c = sinon.stub(autoClient, "configurationValue");
            const fakeConfig = { http: { client: { factory: new fakeHttpClients.FakeHttpClientFactory() }}};
            c.returns(fakeConfig);
            const d = sinon.spy(fakeHttpClients.FakeHttpClient.prototype, "exchange");

            // Create a context
            const ctx = fakeContext();

            // Setup a new relay and set the event target to multiple
            const relay = createFakeRelay("publicDynamicMultiple");

            // Run send data
            await sendData(relay, data, ctx);
            c.restore();
            d.restore();

            // Expect that httpClient.exchange was called twice to send to multiple locations
            assert(d.calledTwice);
        });
        it("should call sdmPostWebhook multiple times when multiple destinations are configured via dynamic eventTarget function", async () => {
            // Create a stub for configurationValue that returns a fake http client and set a spy on the client exchange function
            const c = sinon.stub(autoClient, "configurationValue");
            const fakeConfig = { http: { client: { factory: new fakeHttpClients.FakeHttpClientFactory() }}};
            c.returns(fakeConfig);
            const d = sinon.spy(fakeHttpClients.FakeHttpClient.prototype, "exchange");

            // Create a context
            const ctx = fakeContext();

            // Setup a new relay and set the event target to multiple
            const relay = createFakeRelay("publicStatic");
            relay.targetEvent.eventTarget = async (context, payload) => ["fake.com/test", "fake1.com/test", "fake2.com/test"];

            // Run send data
            await sendData(relay, data, ctx);
            c.restore();
            d.restore();

            // Expect that httpClient.exchange was called twice to send to multiple locations
            assert(d.calledThrice);
        });
    });
    describe("private events", () => {
        it("should call messageClient for single static destination", async () => {
            const ctx = fakeContext();
            const a = sinon.stub(ctx.messageClient, "send");
            a.returns(undefined);
            await sendData(createFakeRelay("privateStatic"), data, ctx);
            a.restore();
            assert(a.calledOnce);
            const args = a.getCall(0).args;
            assert(args[1].hasOwnProperty("userAgent"));
        });
        it("should call messageClient once for multiple static destination", async () => {
            const ctx = fakeContext();
            const a = sinon.stub(ctx.messageClient, "send");
            a.returns(undefined);
            await sendData(createFakeRelay("privateStaticMultiple"), data, ctx);
            a.restore();

            // Validate it was called with multiple destinations
            const args = a.getCall(0).args;
            assert((args[1] as Destination[]).filter(arg => arg.hasOwnProperty("userAgent")).length === 2);

            // Validate send was called just once
            assert(a.calledOnce);
        });
        it("should call messageClient for single dynamic destination", async () => {
            const ctx = fakeContext();
            const a = sinon.stub(ctx.messageClient, "send");
            a.returns(undefined);
            await sendData(createFakeRelay("privateDynamic"), data, ctx);
            a.restore();
            assert(a.calledOnce);
            const args = a.getCall(0).args;
            assert(args[1].hasOwnProperty("userAgent"));
        });
        it("should call messageClient once for multiple dynamic destinations", async () => {
            const ctx = fakeContext();
            const a = sinon.stub(ctx.messageClient, "send");
            a.returns(undefined);
            await sendData(createFakeRelay("privateDynamicMultiple"), data, ctx);
            a.restore();

            // Validate it was called with multiple destinations
            const args = a.getCall(0).args;
            assert((args[1] as Destination[]).filter(arg => arg.hasOwnProperty("userAgent")).length === 2);

            // Validate send was called just once
            assert(a.calledOnce);
        });
    });
});
