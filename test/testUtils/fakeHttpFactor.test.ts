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
    HttpClient,
    HttpClientFactory,
    HttpClientOptions,
    HttpResponse,
} from "@atomist/automation-client";

// HTTP Client just used for testing
export class FakeHttpClient implements HttpClient {
    public exchange<T>(url: string,
                       options: HttpClientOptions = {}): Promise<HttpResponse<T>> {
        // tslint:disable-next-line
        return Promise.resolve({} as HttpResponse<T>);
    }
    protected configureOptions(options: any): any {
        return options;
    }
}

export class FakeHttpClientFactory implements HttpClientFactory {
    public create(url?: string): HttpClient {
        return new FakeHttpClient();
    }
}
