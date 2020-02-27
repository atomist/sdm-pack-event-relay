<p align="center">
  <img src="https://images.atomist.com/sdm/SDM-Logo-Dark.png">
</p>

# @atomist/sdm-pack-event-relay

This extension pack allows an SDM to function as an event relay between event sources and Cortex.  Reasons for doing
this include air-gapped services and needing to "scrub" data from outbound payloads.

An example configuration for a relay configuration:

```typescript
 const bitbucketRelay: EventRelayer<BitbucketTestData> = {
     name: "bitbucketRelay",
     test: payload => !!payload.body.actor && !!payload.body.date && !!payload.body.eventKey,
     processor: async payload => {
         (payload.body as any)["x-bitbucket-type"] = payload.headers["x-event-key"];
         return {body: payload.body, headers: payload.headers};
     },
     targetEvent: {
         eventType: "public",
         eventTarget: sdm.configuration.sdm.git.webhookdest,
         headers: (ctx, payload) => {
             payload.headers = addAtomistSignatureHeader(
                 sdm.configuration.sdm.git.key,
                 payload.body,
                 payload.headers as HttpClientOptions["headers"],
             );
             return payload.headers as HttpClientOptions["headers"];
         },
     },
 };

sdm.addExtensionPacks(
    eventRelaySupport({
        eventRelayers: [
            bitbucketRelay,
        ],
    }),
);
``` 

See the `EventRelayer` interface for details on creating EventRelayer(s).  For details on the extension pack
configuration, see the `eventRelaySupport` type documentation.

## Authentication and/or Validation
By default the event relay pack uses the Atomist API key configured to authorize incoming relay requests.  This key must
be supplied in an authorization header (as a bearer token).  However, this is not appropriate for all use cases.  The
authentication/validation used by the relay pack is pluggable using the `validation` option on `eventRelaySupport`.

There are the 3 built-in validators, or you can build your own (see the `Validator` interface).

`nullValidator`: By using this validator you disable auth/verification completely.  All messages are accepted and then
evaluated to see if any configured relayer knows how to send it.

`apiKeyValidator`: This is the default, and functions as documented above.

`githubHmacValidator`: This validator uses a signature header sent by Github when you supply a secret for your pull
requests (x-hub-signature). The validator loads the shared key from your SDM configuration located at
`sdm.eventRelayer.secret` and uses this to validate the signature in the incoming message.  Should the signatures match,
the message is accepted and the normal event relay process continues.

[atomist-doc]: https://docs.atomist.com/ (Atomist Documentation)

## Getting started

See the [Developer Quick Start][atomist-quick] to jump straight to
creating an SDM.

[atomist-quick]: https://docs.atomist.com/quick-start/ (Atomist - Developer Quick Start)

## Contributing

Contributions to this project from community members are encouraged
and appreciated. Please review the [Contributing
Guidelines](CONTRIBUTING.md) for more information. Also see the
[Development](#development) section in this document.

## Code of conduct

This project is governed by the [Code of
Conduct](CODE_OF_CONDUCT.md). You are expected to act in accordance
with this code by participating. Please report any unacceptable
behavior to code-of-conduct@atomist.com.

## Documentation

Please see [docs.atomist.com][atomist-doc] for
[developer][atomist-doc-sdm] documentation.

[atomist-doc-sdm]: https://docs.atomist.com/developer/sdm/ (Atomist Documentation - SDM Developer)

## Connect

Follow [@atomist][atomist-twitter] and [The Composition][atomist-blog]
blog related to SDM.

[atomist-twitter]: https://twitter.com/atomist (Atomist on Twitter)
[atomist-blog]: https://the-composition.com/ (The Composition - The Official Atomist Blog)

## Support

General support questions should be discussed in the `#support`
channel in the [Atomist community Slack workspace][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist-seeds/sdm-pack/issues

## Development

You will need to install [Node.js][node] to build and test this
project.

[node]: https://nodejs.org/ (Node.js)

### Build and test

Install dependencies.

```
$ npm install
```

Use the `build` package script to compile, test, lint, and build the
documentation.

```
$ npm run build
```

### Release

Releases are handled via the [Atomist SDM][atomist-sdm].  Just press
the 'Approve' button in the Atomist dashboard or Slack.

[atomist-sdm]: https://github.com/atomist/atomist-sdm (Atomist Software Delivery Machine)

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
