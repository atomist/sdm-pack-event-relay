import {HttpClient, HttpClientFactory, HttpClientOptions, HttpResponse} from "@atomist/automation-client";

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
