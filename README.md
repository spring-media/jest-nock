# jest-nock

_Automate request/SSE traffic recording and replay for tests._

![GitHub](https://img.shields.io/github/license/mashape/apistatus.svg)
[![npm version](https://badge.fury.io/js/jest-nock.svg)](https://badge.fury.io/js/jest-nock)

Instead of mocking requests or setting up nock for every test manually,
this setup allows to flag tests that make requests to other systems and
automatically record and replay requests made during a test run.
After recording the requests for your test suite, it will never make real network requests again, so you don't need these external systems available during a test run and your test suite will run much faster, while still ensuring your project integrates well will the used APIs.

## Example

```js
it.nock('uses some method that makes requests to external services', () => async () => {
    const result = await makeSomeRequest();
    expect(result).toBe(derivate);
});
```

## Install

```shell
yarn add jest-nock
```

To use `jest-nock` with your jest setup, add it to your [testFramework file setup](https://jestjs.io/docs/en/configuration.html#setuptestframeworkscriptfile-string). Based on what test runner you are using, you might have to tweak your setup. Have a look at how the tests are setup in this repository.

### Jasmine (default)

```js
const { upgradeJasmine } = require('jest-nock');

upgradeJasmine(global, options);
```

### Circus

Circus does not expose a test file path like `jasmine.testPath`,
using this method `global.__TESTPATH` needs to be set manually.

```js
const { upgradeCircus } = require('jest-nock');

upgradeCircus(global, options);
```

### Global Options

- `nockOptions: Object` - see **API - Nock Options**
- `writeAfterEach: boolean` - writes out the recordings after each test case (used for testing the tool itself).
- `loadAfterEach: boolean` - loads the recordings file before each test case (used for testing the tool itself).

## Usage

- Mark a test to be recorded/replayed with `it.nock(...)`
- Wrap your test method in another function `it.nock(..., () => () => { ... })`
- Set `JEST_NOCK_RECORD=true` in your environment _and_ run the tests you want to record against some real/mock/test API.
- Run your tests without the env variable or `JEST_NOCK_RECORD=false` and see that no real requests are being made.

Recorded requests will be stored in a folder called `__nocks__` next to the file containing the test/suite.

For detailed examples, have a look at the [tests for the tool itself](./jest-nock.test.js).

## API

### Nock Options

Options for recording and replay can be set globally via one of the setup methods (_upgradeJasmine_, _upgradeCircus_) or as the last argument to a test runner method like this:

```js
test.nock('should...', () => () => { /* ... */ }, nockOptions);
```

**Options:**

- `removeHeaders: string[]` - removes the specified headers from API recordings and will therefor not replay them.
- `title: string` - overrides the title for the test, which will be used as a key in the recordings (used for testing the tool itself).

---
Copyright 2020 Sebastian Herrlinger ([Port Blue Sky](https://www.portbluesky.com/))

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.