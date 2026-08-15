// Suppress console.warn output during tests to reduce noise.
// Tests that need to assert on warnings can use jest.spyOn(console, 'warn') locally.
beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});
