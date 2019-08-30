import * as autoClient from "@atomist/automation-client";
import * as assert from "power-assert";
import * as sinon from "sinon";
import {addAtomistSignatureHeader, createHmacSignature, sdmPostWebhook} from "../../lib/support/util";
import * as fakeHttpClients from "../testUtils/fakeHttpFactor.test";
import {fakeHeaders} from "../testUtils/fakeRelayer.test";
describe("util", () => {
    let sandbox: sinon.SinonSandbox;
    before(() => {
        sandbox = sinon.createSandbox();
    });
    after(() => {
        sandbox.reset();
        sandbox.restore();
    });
    describe("createHmacSignature", () => {
        it("should create a signature using sha-1 by default", () => {
            const result = createHmacSignature("testKey", {t: "test"});
            assert.strictEqual(result, "9af0fd8f96d6b143ce149fdcfbc141ce51de582c");
        });
        it("should create a signature using valid supplied algorithm", () => {
            const result = createHmacSignature("testKey", {t: "test"}, "sha256");
            assert.strictEqual(result, "fd3e3389577b6fda00fb56d48ce6465b75936ec61da321b20074374260177125");
        });
    });
    describe("addAtomistSignatureHeader", () => {
        it("should add atomist digest header", () => {
            const result = addAtomistSignatureHeader("testKey", {t: "test"}, {});
            assert(result.hasOwnProperty("x-hub-signature"));
            assert.strictEqual(result["x-hub-signature"], "sha1=9af0fd8f96d6b143ce149fdcfbc141ce51de582c");
        });
        it("should generate atomist digest header with supplied algorithm", () => {
            const result = addAtomistSignatureHeader("testKey", {t: "test"}, {}, "sha256");
            assert(result.hasOwnProperty("x-hub-signature"));
            assert.strictEqual(result["x-hub-signature"], "sha256=fd3e3389577b6fda00fb56d48ce6465b75936ec61da321b20074374260177125");
        });
    });
    describe("sdmPostWebhook", () => {
        it("should automatically stringify body", async () => {
            // Create a stub for configurationValue that returns a fake http client and set a spy on the client exchange function
            const c = sandbox.stub(autoClient, "configurationValue");
            const fakeConfig = { http: { client: { factory: new fakeHttpClients.FakeHttpClientFactory() }}};
            c.returns(fakeConfig);
            const d = sandbox.spy(fakeHttpClients.FakeHttpClient.prototype, "exchange");
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
            const c = sandbox.stub(autoClient, "configurationValue");
            const fakeConfig = { http: { client: { factory: new fakeHttpClients.FakeHttpClientFactory() }}};
            c.returns(fakeConfig);
            const d = sandbox.spy(fakeHttpClients.FakeHttpClient.prototype, "exchange");
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
            const c = sandbox.stub(autoClient, "configurationValue");
            const fakeConfig = { http: { client: { factory: new fakeHttpClients.FakeHttpClientFactory() }}};
            c.returns(fakeConfig);
            const d = sandbox.spy(fakeHttpClients.FakeHttpClient.prototype, "exchange");
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
});
