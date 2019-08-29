import * as autoClient from "@atomist/automation-client";
import * as assert from "power-assert";
import * as sinon from "sinon";
import {sdmPostWebhook} from "../../lib/support/util";
import * as fakeHttpClients from "../utils/fakeHttpFactor.test";
import {fakeHeaders} from "../utils/fakeRelayer.test";

describe("sdmPostWebhook", () => {
    it("should automatically stringify body", async () => {
        // Create a stub for configurationValue that returns a fake http client and set a spy on the client exchange function
        const c = sinon.stub(autoClient, "configurationValue");
        const fakeConfig = { http: { client: { factory: new fakeHttpClients.FakeHttpClientFactory() }}};
        c.returns(fakeConfig);
        const d = sinon.spy(fakeHttpClients.FakeHttpClient.prototype, "exchange");
        await sdmPostWebhook(
            "http://fakeaddress.com",
            fakeHeaders,
            { eventKey: "test", actor: "test", date: "test"},
        );
        c.restore();
        d.restore();

        // Expect that httpClient.exchange was called
        assert(d.called);

        // Validate args
        const args = d.getCall(0).args;
        assert(JSON.parse(args[1].body) && typeof args[1].body === "string");
    });
    it("should set content-type header", async () => {
        // Create a stub for configurationValue that returns a fake http client and set a spy on the client exchange function
        const c = sinon.stub(autoClient, "configurationValue");
        const fakeConfig = { http: { client: { factory: new fakeHttpClients.FakeHttpClientFactory() }}};
        c.returns(fakeConfig);
        const d = sinon.spy(fakeHttpClients.FakeHttpClient.prototype, "exchange");
        await sdmPostWebhook(
            "http://fakeaddress.com",
            fakeHeaders,
            { eventKey: "test", actor: "test", date: "test"},
        );
        c.restore();
        d.restore();

        // Expect that httpClient.exchange was called
        assert(d.called);

        // Validate args
        const args = d.getCall(0).args;
        assert(Object.keys(args[1].headers).includes("Content-Type"));
    });
    it("should call httpClient.exchange multiple times for many dest urls", async () => {
        // Create a stub for configurationValue that returns a fake http client and set a spy on the client exchange function
        const c = sinon.stub(autoClient, "configurationValue");
        const fakeConfig = { http: { client: { factory: new fakeHttpClients.FakeHttpClientFactory() }}};
        c.returns(fakeConfig);
        const d = sinon.spy(fakeHttpClients.FakeHttpClient.prototype, "exchange");
        const dests = [ "http://fakeaddress.com", "http://fakeaddress1.com", "http://fakeaddress2.com" ];
        await sdmPostWebhook(
            dests,
            fakeHeaders,
            { eventKey: "test", actor: "test", date: "test"},
        );
        c.restore();
        d.restore();
        assert.strictEqual(dests.length, d.callCount);
    });
});
