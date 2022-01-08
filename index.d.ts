import nock from "nock/types";

type FnFn = () => () => void;
type NockTest = (title: string, fn: FnFn, timeout?: number) => void;

declare global {
    namespace jest {
        interface It {
            nock: NockTest;
        }
    }
}

type Options = {
    writeAfterEach?: boolean;
    loadAfterEach?: boolean;
    nockOptions?: nock.Options;
};

export function upgradeJasmine(global: typeof globalThis, options?: Options): void;
export function upgradeCircus(global: typeof globalThis, options?: Options): void;
