import {HttpClientOptions} from "@atomist/automation-client";
import * as crypto from "crypto";

export function createHmacSignature(key: string, payload: any, algorithm = "sha1"): string {
    const digest = crypto.createHmac(algorithm, key);
    digest.update(JSON.stringify(payload));
    return digest.digest("hex");
}

export function addAtomistSignatureHeader(
    key: string,
    payload: any,
    headers: HttpClientOptions["headers"],
    algorithm: "sha1" | "sha256" = "sha1",
): HttpClientOptions["headers"] {
    headers["x-hub-signature"] = `sha1=${createHmacSignature(key, payload, algorithm)}`;
    return headers;
}

export function purgeCommonHeaders(
    headers: HttpClientOptions["headers"],
): HttpClientOptions["headers"] {
    delete headers.host;
    delete headers.expect;
    delete headers["content-length"];
    delete headers.authorization;
    delete headers["user-agent"];
    delete headers.accept;

    return headers;
}
