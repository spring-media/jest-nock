# jest-nock
_Automate request traffic recording and replay for tests._

Instead of mocking requests or setting up nock for every test manually,
this setup allows to mark tests that make requests to other systems and
automatically record and replay requests made during a test run.
After recording the requests for your test suite, it will never make real network requests again, so you don't need these external systems available during a test run and your test suite will run much faster, while still ensuring your project integrates well will the used APIs.

## Example
```
it.nock('uses some method that makes requests to external services', () => {
    const result = await makeSomeRequestsAndCombineThem();
    expect(result).toBe(derivate);
});
```

## Install
To use `jest-nock` with yout jest setup, add it to your [testFramework file setup](https://jestjs.io/docs/en/configuration.html#setuptestframeworkscriptfile-string) as follows:
```
const { upgradeJasmine } = require('jest-nock');

upgradeJasmine(jasmine, global);
```


## Usage
 - Mark a test to be recorded/replayed with `it.nock(...)`
 - Set `JEST_NOCK_RECORD=true` in your environment and run the tests you want to record against some real/mock/test API.

Recorded requests will be stored in a folder called `__nocks__` next to the file containing the test/suite.

## Acknowledgements
- @eplawless for djb2 hash [gist](https://gist.github.com/eplawless/52813b1d8ad9af510d85)

---
Copyright 2018 Sebastian Herrlinger (SPRING Axel Springer Digital News Media GmbH)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.